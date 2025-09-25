import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer";
// ✅ CORS setup
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, ApiKey"
};
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  try {
    const { email, password, full_name, bio } = await req.json();
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required." }),
        { status: 400, headers }
      );
    }
    // ✅ Init Supabase with Service Role Key (make sure you add it in project)
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    // ✅ Create Auth user
    const { data: userData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "creator", full_name },
    });
    console.log(userData);
    console.log(authError);
    if (authError) {
      console.error("Auth error:", authError.message);
      return new Response(JSON.stringify({ error: authError.message }), { status: 400, headers });
    }
    const newUser = userData.user;
    const creator_slug = generateCreatorSlug(full_name, email, 127);
    // After inserting new creator row, get back serial_no
    const { data: creatorData, error: dbError } = await supabase.from("creators").insert({
      auth_user_id: newUser.id,
      email,
      bio: bio || '',
      full_name,
      creator_url_id: creator_slug
    }).select("id, serial_no, email, full_name").single();
    console.log(creatorData);
    console.log(dbError);
    if (dbError) throw dbError;
    const creator_slug2 = generateCreatorSlug(full_name, email, creatorData.serial_no);
    // Now update row with final url_id
    await supabase.from("creators").update({
      creator_url_id: creator_slug2
    }).eq("id", creatorData.id);
    sendEmailToCreator(full_name, email, creator_slug2, password);
    return new Response(JSON.stringify({
      creator: creatorData
    }), {
      status: 200,
      headers
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers
    });
  }
});
function generateCreatorSlug(full_name, email, serial) {
  let base = "";
  if (full_name && full_name.trim().length > 0) {
    base = full_name.trim().toLowerCase();
  } else {
    base = email.split("@")[0].toLowerCase();
  }
  // replace spaces, dots, and special chars with underscores
  base = base.replace(/[\s.]+/g, "_");
  return `${base}_${serial}`;
}
function sendEmailToCreator(full_name, email, url_id, pass) {
  const SMTP = {
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
  };
  const transporter = nodemailer.createTransport(SMTP);
  // Step 5: Send Email
  const userData = {
    from: '"Creator Accountability" <noreply@codexiatech.com>',
    to: email || "asimilyas527@gmail.com",
    subject: `Welcome to the Creator Accountability Challenge, Your Account is Ready`,
    html: getHtmlTemplate(full_name, email, url_id, pass),
    text: `Welcome to the Creator Accountability Challenge, Your Account is Ready`
  };
  transporter.sendMail(userData, (error, info)=>{
    console.log('user:', info, 'error', error);
  });
}
function getHtmlTemplate(full_name, email, url_id, pass) {
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
                Welcome to the Creator Accountability Challenge
              </h1>
            </div>   
            <div class="content">
                <p>Hi <b>${full_name}<b>,</p>
                <p>
                 Your Creator account has been successfully set up for the LinkedIn Challenge. 
      You can now log in to your dashboard, update your profile, and share your unique 
      creator link with your followers so they can join and participate.
                </p>

                    <div class="details" style="margin:20px 0; padding:15px; background:#f7f7f7; border-radius:6px;">
      <h2 style="margin-top:0; font-size:16px; color:#1a73e8;">Your Account Details:</h2>
      <p><b>Login Email:</b> ${email}</p>
      <p><b>Password:</b> ${pass}</p>
      <p><b>Your Creator Link:</b> 
        <a href="https://creator-accountability.web.app/?creators=${url_id}" target="_blank">
          https://creator-accountability.web.app/?creators=${url_id}
        </a>
      </p>
      <p style="margin-top:10px; font-size:14px; color:#555;">
        Please use the above credentials to log in and remember to change your password 
        immediately after your first login for security purposes.
      </p>
    </div>
        <div class="call-to-action" style="margin:20px 0; text-align:center;">
      <a href="https://cpanel-creator-accountability.web.app/login" target="_blank" 
         style="background:#1a73e8; color:#fff; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:bold;">
        Login to Creator Dashboard
      </a>
    </div>

 <p>
      Thank you for joining the Creator Accountability Challenge. We’re excited to have you on board and 
      look forward to supporting your journey!
    </p>
    <p>Best regards,<br><b>The Creator Accountability Team</b></p>
  </div>

  <div class="footer" style="text-align:center; font-size:12px; color:#888; margin-top:20px;">
    <p>You are receiving this email because an Admin created your account for the Creator Accountability Challenge.</p>
  </div>
        </div>
    </body>
    </html>
  `;
  return emailHtml;
}