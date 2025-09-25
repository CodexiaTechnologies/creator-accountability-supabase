import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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
  // This key is necessary to bypass Row Level Security and update any user's data
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    console.log("Starting daily challenge check...");

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

    const { data: users, error: userError } = await supabase
      .from("users")
      .select("*")
      .not("stripe_customer_id", "is", null)
      .not("start_date", "is", null)
      .not("is_completed", "is", true)
    // .lte("start_date", currentDate)
    // .gte("end_date", currentDate);

    if (userError) throw userError;

    console.log(`👤 Found ${users?.length || 0} active users`);

    for (const user of users || []) {
      console.log(`➡️ Checking user: ${user.id}, ${user.email}`);

      // Step 3: Check submissions
      const { data: submissions, error: submissionError } = await supabase
        .from("user_post_submissions").select("id, status, created_at")
        .eq("user_id", user.id)
        .gte("created_at", `${currentDate}T00:00:00.000Z`)
        .lte("created_at", `${currentDate}T23:59:59.999Z`);
      if (submissionError) throw submissionError;

      const validSubmission = submissions?.some(
        (s) => s.status && s.status.toLowerCase() !== "rejected"
      );

      if (validSubmission) {
        console.log(`✅ User ${user.id} has a valid submission`);
        continue;
      }


      // Step 5: Send Email
      const userData = {
        from: '"Creator Accountability" <noreply@codexiatech.com>',
        to: user.email || "asimilyas527@gmail.com",
        subject: `Action Required: Your Linkedin Submission is Pending`,
        html: getHtmlTemplate(user, currentDate),
        text: `Action Required: Your Linkedin Submission is Pending`,
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
                Challenge Submission is Pending
              </h1>
            </div>   
            <div class="content">
                <p>Hello ${user.name},</p>
                <p>This is a reminder that your daily submission for the LinkedIn challenge is pending for today, <b>${formattedDate}</b>.</p>
                <p>As per the challenge rules, a penalty of <b>$15</b> will be deducted from your Stripe account if your submission is not completed by the deadline. The transaction will be recorded, and you can view the details in your dashboard.</p>
                <div class="details">
                    <h2>Action Required:</h2>
                    <p>To avoid deductions and stay on track, please ensure you submit today's post and comment URLs as soon as possible.</p>
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