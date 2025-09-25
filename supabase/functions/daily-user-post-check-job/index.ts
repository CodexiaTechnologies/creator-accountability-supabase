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
  const stripe = new Stripe(Deno.env.get("STRIPE_ASIM_TEST_KEY") ?? "", { apiVersion: "2020-08-27" });

  try {
    console.log("Starting daily challenge check...");

    // 3. Get yesterday's date for comparison
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];
    const currentDate = new Date().toISOString().split('T')[0];


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

    const { data: users, error: userError } = await supabase
      .from("users")
      .select("*")
      .not("stripe_customer_id", "is", null)
      .not("start_date", "is", null)
      .not("is_completed", "is", true)
    // .lte("start_date", currentDate)
    // .gte("end_date", yesterdayDate);

    if (userError) throw userError;

    console.log(`👤 Found ${users?.length || 0} active users`);

    for (const user of users || []) {
      console.log(`➡️ Checking user: ${user.id}, ${user.email}`);

      // 🛑 Check if challenge ended
      if (new Date(currentDate) > new Date(user.end_date)) {

        const { error: completeError } = await supabase.from("users").update({ is_completed: true }).eq("id", user.id);

        if (completeError) {
          console.error(`❌ Error updating user ${user.id} to completed`, completeError);
        } else {
          console.log(`🏁 Marked user ${user.id} as completed`);
        }

      }

      // Step 2: Check payment_intents
      const { data: paymentExists, error: paymentError } = await supabase
        .from("payment_intents").select("id")
        .eq("user_id", user.id).eq("missed_date", yesterdayDate).maybeSingle();

      if (paymentError) throw paymentError;
      if (paymentExists) {
        console.log(`✅ Payment already exists for ${user.id}`);
        continue;
      }

      // Step 3: Check submissions
      const { data: submissions, error: submissionError } = await supabase
        .from("user_post_submissions").select("id, status, created_at")
        .eq("user_id", user.id)
        .gte("created_at", `${yesterdayDate}T00:00:00.000Z`)
        .lte("created_at", `${yesterdayDate}T23:59:59.999Z`);
      if (submissionError) throw submissionError;

      const validSubmission = submissions?.some(
        (s) => s.status && s.status.toLowerCase() !== "rejected"
      );

      if (validSubmission) {
        console.log(`✅ User ${user.id} has a valid submission`);
        continue;
      }

      // Step 3: Deduct penalty + record in DB
      const paymentResult = await processPenalty(user, yesterdayDate);

      // Step 4: Insert penalty record regardless of Stripe success/failure
      const { error: insertError } = await supabase.from("payment_intents").insert({
        user_id: user.id,
        stripe_customer_id: user.stripe_customer_id,
        amount: 15.0,
        missed_date: yesterdayDate,
        transaction_id: paymentResult?.transactionId || null,
        is_paid: paymentResult?.status === "completed",
        payment_status: paymentResult?.status || "Pending",
        remarks: "User missed the submission",
      });

      if (insertError) {
        console.error(`❌ Error inserting payment for ${user.id}`, insertError);
      } else {
        console.log(`💰 Payment record created for user ${user.id}`);
      }

      // Step 5: Send Email
      const userData = {
        from: '"Creator Accountability" <noreply@codexiatech.com>',
        to: user.email || "asimilyas527@gmail.com",
        subject: `Deduction Confirmed: Missed Linkedin Challenge Submission`,
        html: getHtmlTemplate(user, yesterdayDate),
        text: `Deduction Confirmed: Missed Linkedin Challenge Submission`,
      };

      transporter.sendMail(userData, (error, info) => {
        console.log('user:', info, 'error', error);
      });

    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });


  } catch (err: any) {
    console.error("An unexpected error occurred:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


function getHtmlTemplate(user, missedDate) {

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
                <p>As per the challenge rules, a penalty of <b>$15</b> has been deducted from your Stripe account. The transaction has been recorded, and you can view the details in your dashboard.</p>
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


/**
 * Deducts $15 penalty from a user and records it in Supabase.
 * Returns { status: "completed" | "failed", transactionId?: string }
 */
export async function processPenalty(user: any, yesterdayDate: string) {
  let confirmedPayment = null;
  let paymentStatus = "failed";

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1500,
      currency: "usd",
      customer: user.stripe_customer_id,
      description: `Missed submission fine for user ${user.id} on ${yesterdayDate}`,
    });

    confirmedPayment = await stripe.paymentIntents.confirm(paymentIntent.id, {
      payment_method: "pm_card_visa", // ⚠️ testing only
    });

    console.log(`✅ Stripe payment successful. Txn: ${confirmedPayment.id}`);
    paymentStatus = "completed";
  } catch (err: any) {
    console.error(`❌ Stripe payment failed for user ${user.id}`, err.message);
    paymentStatus = "failed"; // don't throw
  }

  return {
    status: paymentStatus,
    transactionId: confirmedPayment?.id || null,
  };

}