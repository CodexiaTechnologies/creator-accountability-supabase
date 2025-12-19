import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@12.1.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, ApiKey',
};


serve(async (req) => {
  // Handle preflight OPTIONS requests from cron services
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 2. Initialize Supabase client with the service role key
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const stripeDefault = new Stripe(Deno.env.get("STRIPE_TEST_KEY") ?? "", { apiVersion: "2020-08-27" });

  try {
    console.log("Starting daily challenge check...");

    // 3. Get yesterday's date for comparison
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];
    const currentDate = new Date().toISOString().split('T')[0];
    const isMonday = new Date().getDay() === 1; // 1 = Monday (Day after Sunday end)

    const SMTP = {
      name: "Creator Accountability",
      host: 'premium154.web-hosting.com',
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: "noreply@codexiatech.com",
        pass: "D65hj)OcLas0"
      },
      tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false
      }
    }
    const transporter = nodemailer.createTransport(SMTP);

    // Step 1: Get active users
    // const { data: users, error: userError } = await getActiveUsers(currentDate, yesterdayDate);


    // 1. Fetch Users and Submissions
    const { data: users } = await supabase.from("users").select("*").eq("is_active", true);
    const { data: submissions } = await supabase.from("user_post_submissions")
      .select("*")
      .gte("created_at", `${yesterdayDate}T00:00:00.000Z`)
      .lte("created_at", `${yesterdayDate}T23:59:59.999Z`);

    const { data: settings } = await supabase.from("shares_settings").select("*").single();
    const FINE_AMOUNT = settings?.charging_amount || 20;

    let totalFinesCollected = 0;
    const earners: any[] = [];
    const missers: any[] = [];

    // 2. Sort Users (Earnings are Card-Only, Streaks are for Everyone)
    for (const user of users || []) {
      const hasCard = !!user.stripe_customer_id;
      if (hasCard) {
        const submission = submissions?.find(s => s.user_id === user.id && s.status !== 'rejected');
        if (submission) earners.push(user);
        else missers.push(user);
      }
    }

    for (const user of missers) {
      const { data: paymentExists } = await supabase.from("payment_intents")
        .select("id").eq("user_id", user.id).eq("missed_date", yesterdayDate).maybeSingle();
      console.log(user.email, paymentExists, paymentError)
      if (!paymentExists) {
        let isPaid = false, paymentData = null, rejectedData = null;
        try {
          let s_key_env = user.stripe_env || "STRIPE_TEST_KEY";
          const stripe = new Stripe(Deno.env.get(s_key_env) ?? "", { apiVersion: "2020-08-27" });

          paymentData = await userStripe.paymentIntents.create({
            amount: FINE_AMOUNT * 100,
            currency: 'usd',
            customer: user.stripe_customer_id,
            payment_method: user.default_payment_method,
            confirm: true,
            off_session: true,
            description: `Rejected submission fine for user ${user.id} on ${yesterdayDate}`,
          });
          console.log(user.email, paymentData)

          isPaid = (paymentData?.status === "succeeded" ||
            paymentData?.charges?.data?.[0]?.paid === true ||
            paymentData?.charges?.data?.[0]?.status === "succeeded");

        } catch (err) {
          rejectedData = err;
        }

        await supabase.from("payment_intents").insert({
          user_id: user.id,
          amount: FINE_AMOUNT,
          is_paid: isPaid,
          payment_status: isPaid ? "Completed" : "Failed",
          missed_date: yesterdayDate,
          remarks: "Missed submission fine",
          creator_id: '',
          stripe_customer_id: user.stripe_customer_id,
          stripe_account_id: '',
          creator_amount: 0,
          currency: "usd",
          transaction_data: paymentData ? JSON.stringify(paymentData) : null,
          rejected_data: rejectedData ? JSON.stringify(rejectedData) : null,
          transaction_id: paymentData?.id || null,
          payment_method_id: user.default_payment_method || "",
        });

        if (isPaid) {
          totalFinesCollected += FINE_AMOUNT;
          const userData = {
            from: '"Creator Accountability" <noreply@codexiatech.com>',
            to: user.email || "asimilyas527@gmail.com",
            subject: `Deduction Confirmed: Missed Linkedin Challenge Submission`,
            html: getHtmlTemplate(user, yesterdayDate, FINE_AMOUNT),
            text: `Deduction Confirmed: Missed Linkedin Challenge Submission`,
          };

          transporter.sendMail(userData, (error, info) => {
            console.log('user:', info, 'error', error);
          });
        }
      }
    }

    // 4. Calculate Daily Reward Pool
    const rewardPool = totalFinesCollected * 0.8;
    const rewardPerUser = earners.length > 0 ? (rewardPool / earners.length) : 0;

    // Record the daily pot state
    await supabase.from("daily_pot_records").insert({
      record_date: yesterdayDate,
      total_fines_collected: totalFinesCollected,
      reward_pool_amount: rewardPool,
      eligible_winners_count: earners.length,
      reward_per_user: rewardPerUser
    });

    // 5. Update User Stats & Leaderboard Data
    for (const user of users || []) {
      const isEarner = earners.some(e => e.id === user.id);
      const isMisser = missers.some(m => m.id === user.id);
      const submitted = submissions?.some(s => s.user_id === user.id && s.status !== 'rejected');

      const { data: currentStats } = await supabase.from("user_stats").select("*").eq("user_id", user.id).maybeSingle();

      const newStats = {
        user_id: user.id,
        current_streak: submitted ? (currentStats?.current_streak || 0) + 1 : 0,
        current_week_streak: submitted ? (currentStats?.current_week_streak || 0) + 1 : 0,
        total_money_lost: isMisser ? (currentStats?.total_money_lost || 0) + FINE_AMOUNT : (currentStats?.total_money_lost || 0),
        current_week_pending_rewards: isEarner ? (currentStats?.current_week_pending_rewards || 0) + rewardPerUser : (currentStats?.current_week_pending_rewards || 0),
        total_money_earned: isEarner ? (currentStats?.total_money_earned || 0) + rewardPerUser : (currentStats?.total_money_earned || 0),
      };

      if (newStats.current_streak > (currentStats?.highest_streak || 0)) {
        newStats.highest_streak = newStats.current_streak;
      }

      await supabase.from("user_stats").upsert(newStats);
    }

    // 6. Weekly Payout Logic (Runs on Monday morning for previous week)
    if (isMonday) {
      await handleWeeklyPayout(supabase, stripeDefault);
    }

    return new Response(JSON.stringify({ success: true, rewardPerUser }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("An unexpected error occurred:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});


async function handleWeeklyPayout(supabase: any, stripe: any) {
  const { data: stats } = await supabase.from("user_stats").select("*, users(email, stripe_account_id)").gt("current_week_pending_rewards", 0);

  for (const stat of stats || []) {
    // Logic for transferring 'current_week_pending_rewards' to user via Stripe Connect
    // After transfer success:
    await supabase.from("user_stats").update({
      current_week_pending_rewards: 0,
      current_week_streak: 0
    }).eq("user_id", stat.user_id);
  }
}

function getHtmlTemplate(user, missedDate, FINE_AMOUNT) {

  const missedDateObj = new Date(missedDate);
  const formattedDate = missedDateObj.toLocaleDateString("en-US", {
    weekday: "long",   // e.g. Sunday
    year: "numeric",
    month: "long",     // e.g. August
    day: "numeric",    // e.g. 17
  });

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; }
            .header { background-color: #1a73e8; color: #ffffff; padding: 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; line-height: 1.6; color: #333333; }
            .content h2 { color: #1a73e8; }
            .details { background-color: #f9f9f9; padding: 20px; border-radius: 6px; border: 1px solid #eeeeee; margin-top: 20px; }
            .details p { margin: 5px 0; }
            .call-to-action { text-align: center; margin-top: 30px; }
            .call-to-action a { display: inline-block; padding: 12px 24px; background-color: #1a73e8; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #999999; }
        </style>
    </head>
    <body>
        <div class="container">
          <div class="header" style="text-align:center;">
            <img src="https://eduxia.codexia.tech/creator-logo.png" alt="Creator Logo" 
              style="max-height:65px; display:block; margin:0 auto;" />
            <h1 style="margin:10px 0 0 0; font-size:20px; font-family:sans-serif; color:#ffffff;">
              Challenge Submission Missed
            </h1>
          </div>
            <div class="content">
                <p>Hello ${user.name},</p>
                <p>This email is to inform you that you have missed your daily submission for the LinkedIn challenge on <b>${formattedDate}</b>.</p>
                <p>As per the challenge rules, a penalty of <b>${FINE_AMOUNT || '20'}</b> has been deducted from your Stripe account. The transaction has been recorded, and you can view the details in your dashboard.</p>
                <div class="details">
                    <h2>Action Required:</h2>
                    <p>To avoid any further deductions, please ensure you submit today's post and comment URLs.</p>
                </div>
                <div class="call-to-action">
                    <a href="https://creator-accountability.web.app/" target="_blank">Go to My Dashboard</a>
                </div>
                <p>Thank you for your commitment to the Creator Accountability challenge. We're here to help you succeed!</p>
                <p>Best regards,<br>The Creator Accountability Team</p>
            </div>
            <div class="footer">
                <p>You are receiving this email because you are a participant in the Creator Accountability challenge.</p>
            </div>
        </div>
    </body>
    </html>
  `;

  return emailHtml;
}