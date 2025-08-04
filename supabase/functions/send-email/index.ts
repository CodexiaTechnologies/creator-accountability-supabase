import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

import nodemailer from "npm:nodemailer";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.json();

    console.log('payload record', payload.record);
    // Extract the 'record' from the payload. This 'record' contains the new row data that was inserted.
    const newRecord = payload.record;


    const userFullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Challenge Submission Missed</title>
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
            <p>Hello **${user.name}**,</p>
            <p>This email is to inform you that you have missed your daily submission for the LinkedIn challenge on **${yesterday}**.</p>
            <p>As per the challenge rules, a penalty of **$15** has been deducted from your Stripe account. The transaction has been recorded, and you can view the details on your dashboard.</p>
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
</html>`


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
        console.log( 'user:', info);
        console.log( 'user:', error);
      });

    return new Response("Email sent successfully", { status: 200 });

  } catch (error) {
    console.error("Error processing sending email request :", error);
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
});