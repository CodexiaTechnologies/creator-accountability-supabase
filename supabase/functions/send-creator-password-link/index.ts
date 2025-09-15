import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, ApiKey"
};
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({
        error: "Email is required"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ✅ Step 1: Check if user exists in Auth
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw userError;
    const user = users?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      return new Response(JSON.stringify({
        error: "No account found with this email"
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ✅ Step 2: Generate password reset (recovery) link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: "https://cpanel-creator-accountability.web.app/update-password"
      }
    });
    if (linkError) throw linkError;
    const resetLink = linkData?.properties?.action_link || "https://cpanel-creator-accountability.web.app/update-password";
    if (!resetLink) {
      return new Response(JSON.stringify({
        error: "Failed to generate reset link"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ✅ Step 3: Setup SMTP transport
    const transporter = nodemailer.createTransport({
      name: "Creator Accountability",
      host: 'premium154.web-hosting.com',
      port: 465,
      secure: true,
      auth: {
        user: "noreply@codexiatech.com",
        pass: "D65hj)OcLas0"
      },
      tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false
      }
    });
    // ✅ Step 4: Prepare Email
    const mailOptions = {
      from: '"Creator Accountability" <noreply@codexiatech.com>',
      to: email,
      subject: "Reset Your Password – Creator Accountability",
      html: getHtmlTemplate(email, resetLink),
      text: `Hello, reset your password here: ${resetLink}`
    };
    await transporter.sendMail(mailOptions);

    return new Response(JSON.stringify({
      success: true,
      message: "Reset email sent"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("Unexpected error thrown:", err);
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
// ✅ Custom HTML Email Template
function getHtmlTemplate(email, resetLink) {
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
                Reset Your Password
              </h1>
            </div>   
            <div class="content">
                <p>Hello ${email},</p>
                <p>We received a request to reset your password. Click the button below to set a new one:</p>
                <div class="call-to-action">
                    <a href="${resetLink}" target="_blank">Click To Reset Password</a>
                </div>
                <p>If you didn’t request this, you can safely ignore this email.</p>
                <p>Best regards,<br>The Creator Accountability Team</p>
            </div>
        </div>
    </body>
    </html>
  `;
  return emailHtml;
}
