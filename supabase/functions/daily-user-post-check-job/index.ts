import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@12.1.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from "npm:nodemailer";

const stripe = new Stripe("sk_test_51Rpr1u0mDkO4nNWr2uYJ7C7jkvCMdgDncsmNFAAfmfSrZ7iExaaZtBvyyjV9qChaozhtjkAmZQ1ey9kYWSPkAfGN00yVt4SALY", { apiVersion: "2020-08-27" });


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
  // This key is necessary to bypass Row Level Security and update any user's data
  const supabase = createClient(
    'https://swyqqttetwwjrvlcsfam.supabase.co/',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eXFxdHRldHd3anJ2bGNzZmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NTYzODUsImV4cCI6MjA2OTQzMjM4NX0.KP_4Ejbh8hPlT_QkBT7TR5x9EVPFUgkdyd18l1XK2p0'
  );

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
    // .not("is_completed", "is", true)
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

      // Step 4: Insert penalty
      const { error: insertError } = await supabase.from("payment_intents").insert({
        user_id: user.id,
        stripe_customer_id: user.stripe_customer_id,
        amount: 15.0,
        missed_date: yesterdayDate,
        is_paid: false,
        payment_status: "completed",
        remarks: "User missed the submission",
      });
      
      if (insertError) {
        console.error(`❌ Error inserting payment for ${user.id}`, insertError);
      } else {
        console.log(`💰 Payment record created for user ${user.id}`);
      }

       // Step 5: Send Email
      const userData = {
        from: '"Creator Accountability App" <noreply@codexiatech.com>',
        to: "asimilyas527@gmail.com", // user.email || 
        subject: `Your Challenge Submission for ${yesterdayDate} was Missed`,
        html: getHtmlTemplate(user, yesterdayDate),
        text: `Your Challenge Submission for ${yesterdayDate} was Missed`,
      };

      transporter.sendMail(userData, (error, info) => {
        console.log('user:', info, 'error', error);
      });

    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });


    // 7. If no submission found, proceed with the fine deduction
    //try {
    // Deduct $15.00 (1500 cents) from Stripe
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: 1500,
    //   currency: 'usd',
    //   customer: stripe_customer_id,
    //   description: `Missed submission fine for user ${user_id} on ${yesterdayDate}`,
    // });

    // // Confirm the payment intent
    // const confirmedPayment = await stripe.paymentIntents.confirm(
    //   paymentIntent.id,
    //   { payment_method: 'pm_card_visa' } // Example payment method for testing
    // );

    // console.log(`Stripe payment successful. Transaction ID: ${confirmedPayment.id}`);

    // } catch (stripeError: any) {
    //   console.error(`Stripe charge failed for user ${user_id}:`, stripeError.message);
    //   // Log the failed payment attempt in your database
    //   await supabase.from('payment_intents').insert({
    //     user_id: user_id,
    //     date_missed: yesterdayDate,
    //     amount_deducted: 15.00,
    //     transaction_id: null,
    //     payment_status: 'failed',
    //     error_message: stripeError.message,
    //   });
    // }


  } catch (err: any) {
    console.error("An unexpected error occurred:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


function getHtmlTemplate(user, missedDate) {

  const missedDateObj = new Date(yesterdayDate);
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
            <div class="header">
                <h1>Challenge Submission Missed</h1>
            </div>
            <div class="content">
                <p>Hello ${user.name},</p>
                <p>This email is to inform you that you have missed your daily submission for the LinkedIn challenge on <b>${formattedDate}</b>.</p>
                <p>As per the challenge rules, a penalty of <b>$15</b> has been deducted from your Stripe account. The transaction has been recorded, and you can view the details in your dashboard.</p>
                <div class="details">
                    <h2>Action Required:</h2>
                    <p>To avoid further deductions and stay on track, please ensure you submit today's post and comment URLs.</p>
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