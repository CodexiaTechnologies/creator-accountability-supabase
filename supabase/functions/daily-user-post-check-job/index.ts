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


// Function to send the email
async function sendMissedSubmissionEmail(user, missedDate) {
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
                <p>This email is to inform you that you have missed your daily submission for the LinkedIn challenge on **${missedDate}**.</p>
                <p>As per the challenge rules, a penalty of **$15** has been deducted from your Stripe account. The transaction has been recorded, and you can view the details in your dashboard.</p>
                <div class="details">
                    <h2>Action Required:</h2>
                    <p>To avoid further deductions and stay on track, please ensure you submit today's post and comment URLs.</p>
                </div>
                <div class="call-to-action">
                    <a href="[YOUR_DASHBOARD_URL]" target="_blank">Go to My Dashboard</a>
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

  try {

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

    const userData = {
      from: '"Creator Accountability App" <noreply@codexiatech.com>',
      to: user.email || "asimilyas527@gmail.com",
      subject: `Action Required: Your Challenge Submission for ${yesterday} was Missed`,
      html: userFullHtml,
      text: `Action Required: Your Challenge Submission for ${yesterday} was Missed`,
    };

    transporter.sendMail(userData, (error, info) => {
      console.log('user:', info);
      console.log('user:', error);
    });

    console.log(`Email sent successfully to user ${user.id}`);
    return new Response("Email sent successfully", { status: 200 });
  } catch (err) {
    console.error(`Failed to send email to user ${user.id}:`, err);
  }
}


serve(async (req) => {
  // Handle preflight OPTIONS requests from cron services
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {

    console.log('test 1');
      // 2. Initialize Supabase client with the service role key
  // This key is necessary to bypass Row Level Security and update any user's data
  const supabase = createClient(
    'https://swyqqttetwwjrvlcsfam.supabase.co/',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eXFxdHRldHd3anJ2bGNzZmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NTYzODUsImV4cCI6MjA2OTQzMjM4NX0.KP_4Ejbh8hPlT_QkBT7TR5x9EVPFUgkdyd18l1XK2p0'
  );

    console.log("Starting daily challenge check...");

    // 3. Get yesterday's date for comparison
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split('T')[0];
    const currentDate = new Date().toISOString().split('T')[0];

    // 4. Find all users who are in an active challenge
    // An active user is defined as having a stripe_customer_id, a start_date, and is_completed is false.
    const { data: activeUsers, error: usersError } = await supabase
      .from('users')
      .select(`id, stripe_customer_id, start_date, end_date, failed_days`)
      .not('stripe_customer_id', 'is', null) // Must have a Stripe customer ID
      .not('start_date', 'is', null) // Must have started a challenge
      .not('is_completed', 'is', true) // Challenge must not be completed
      .lt('start_date', currentDate) // Start date must be in the past
      .gt('end_date', yesterdayDate); // End date must be in the future (or equal to yesterday)

    if (usersError) {
      console.error("Error fetching active users:", usersError);
      throw new Error("Failed to fetch active users.");
    }

    console.log(`Found ${activeUsers.length} active users to check.`);

    if (activeUsers.length === 0) {
      return new Response(JSON.stringify({ message: "No active users found." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Process each active user
    const promises = activeUsers.map(async (user) => {
      const { id: user_id, stripe_customer_id, end_date, failed_days } = user;

      // 6. Check for a submission from this user for yesterday
      const { data: submission, error: submissionError } = await supabase
        .from('user_post_submissions')
        .select('id')
        .eq('user_id', user_id)
        .eq('created_at', yesterdayDate) // Assuming 'created_at_date' column exists in your table
        .maybeSingle();

      if (submissionError) {
        console.error(`Error fetching submission for user ${user_id}:`, submissionError);
        return;
      }

      // 7. If no submission found, proceed with the fine deduction
      if (!submission) {
        console.log(`User ${user_id} missed a submission on ${yesterdayDate}. Deducting $15.`);

        try {
          // Deduct $15.00 (1500 cents) from Stripe
          const paymentIntent = await stripe.paymentIntents.create({
            amount: 1500,
            currency: 'usd',
            customer: stripe_customer_id,
            description: `Missed submission fine for user ${user_id} on ${yesterdayDate}`,
          });

          // Confirm the payment intent
          const confirmedPayment = await stripe.paymentIntents.confirm(
            paymentIntent.id,
            { payment_method: 'pm_card_visa' } // Example payment method for testing
          );

          console.log(`Stripe payment successful. Transaction ID: ${confirmedPayment.id}`);

          // 8a. Update the 'users' table to reflect the missed day
          const newFailedDays = (failed_days || 0) + 1;
          const { error: usersUpdateError } = await supabase
            .from('users')
            .update({ failed_days: newFailedDays })
            .eq('id', user_id);

          if (usersUpdateError) {
            console.error("Error updating users table:", usersUpdateError);
          }


          // 8b. New: Send the email notification **
          await sendMissedSubmissionEmail(user, yesterdayDate);

          // 8c. Insert a new row into the 'payment_intents' table
          const { error: paymentInsertError } = await supabase
            .from('payment_intents')
            .insert({
              user_id: user_id,
              missed_date: yesterdayDate,
              amount: 15.00,
              transaction_id: confirmedPayment.id,
              payment_status: confirmedPayment.status,
            });

          if (paymentInsertError) {
            console.error("Error inserting payment intent:", paymentInsertError);
          }


        } catch (stripeError: any) {
          console.error(`Stripe charge failed for user ${user_id}:`, stripeError.message);
          // Log the failed payment attempt in your database
          await supabase.from('payment_intents').insert({
            user_id: user_id,
            date_missed: yesterdayDate,
            amount_deducted: 15.00,
            transaction_id: null,
            payment_status: 'failed',
            error_message: stripeError.message,
          });
        }
      }

      // 9. Check if challenge is complete
      const isComplete = new Date(yesterdayDate).getTime() >= new Date(end_date).getTime();
      if (isComplete) {
        const { error: usersUpdateError } = await supabase
          .from('users')
          .update({ is_completed: true })
          .eq('id', user_id);

        if (usersUpdateError) {
          console.error("Error marking user's challenge as complete:", usersUpdateError);
        }
        console.log(`Challenge for user ${user_id} marked as complete.`);
      }
    });

    // Wait for all asynchronous operations to finish
    await Promise.all(promises);

    console.log("Daily check completed successfully.");

    return new Response(JSON.stringify({ message: "Daily challenge check complete." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("An unexpected error occurred:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});