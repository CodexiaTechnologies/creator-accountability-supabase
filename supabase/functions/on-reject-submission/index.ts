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

  console.log("req", req.method);


  // Handle preflight OPTIONS requests from cron services
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Combine CORS headers with content type for the main responses
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  // 2. Initialize Supabase client with the service role key
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    // Attempt to parse the request body
    const { user } = await req.json();

    // Input validation
    if (!user?.id) {
      return new Response(JSON.stringify({ error: "Missing userId." }), {
        status: 400,
        headers: headers,
      });
    }

    const { data: creator, error: creatorError } = await supabase.from("creators").select("id, stripe_account_id, stripe_env").eq("id", user.creator_id).single();

    const { data: settings_list, error: settingsError } = await supabase.from("shares_settings").select("*");

    let shares_data = settings_list?.length ? settings_list[0] : {}

    const currentDate = new Date().toISOString().split('T')[0];

    // Step 3: Deduct penalty + record in DB
    const paymentResult = await processPenalty(user, creator, shares_data, currentDate);

    // Step 4: Insert penalty record regardless of Stripe success/failure
    const { error: insertError } = await supabase.from("payment_intents").insert({
      user_id: user.id,
      creator_id: creator?.id || '',
      stripe_customer_id: paymentResult?.customer || user.stripe_customer_id,
      stripe_account_id: creator?.stripe_account_id || '',
      amount: paymentResult?.amount || shares_data?.charging_amount || 15.0,
      creator_amount: paymentResult?.creator_amount || 0,
      currency: paymentResult?.currency || "usd",
      missed_date: currentDate,
      transaction_data: paymentResult?.transaction ? JSON.stringify(paymentResult.transaction) : null,
      rejected_data: paymentResult?.rejectedData ? JSON.stringify(paymentResult.rejectedData) : null,
      transaction_id: paymentResult?.transaction?.id || null,
      payment_method_id: paymentResult?.payment_method || user.default_payment_method || "",
      is_paid: paymentResult?.status === "Completed" ? true : false,
      payment_status: paymentResult?.status || "Pending",
      remarks: "Admin rejected the submission",
    });

    if (insertError) {
      console.error(`❌ Error inserting payment for ${user.id}`, insertError);
    }

    // Step 5: Send Email

    if (paymentResult?.status === "Completed") {

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
        from: '"Creator Accountability" <noreply@codexiatech.com>',
        to: user.email || "asimilyas527@gmail.com",
        subject: `Deduction Confirmed: Linkedin Challenge Submission Rejected`,
        html: getHtmlTemplate(user, currentDate),
        text: `Deduction Confirmed: Linkedin Challenge Submission Rejected`,
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
              Challenge Submission Rejected
            </h1>
          </div>           
            <div class="content">
                <p>Hello ${user.name},</p>
                <p>This email is to inform you that your daily submission for the LinkedIn challenge on <b>${formattedDate}</b> Rejected by Admin.</p>
                <p>As per the challenge rules, a penalty of <b>$15</b> has been deducted from your Stripe account. The transaction has been recorded, and you can view the details in your dashboard.</p>
                <div class="details">
                    <h2>Action Required:</h2>
                    <p>To avoid any further deductions, please ensure you submit valid post and comment URLs.</p>
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
export async function processPenalty(user: any, creator: any, shares_data: any, currentDate: string) {

  let returnObj: any = {
    amount: (shares_data?.charging_amount || 15), // $15 fine in cents
    status: "failed",
    transaction: null,
    rejectedData: null,
    currency: "usd",
    customer: user.stripe_customer_id,
    payment_method: user.default_payment_method || "pm_card_visa",
    description: `Rejected submission fine for user ${user.id} on ${currentDate}`,
    creator_amount: (shares_data?.charging_amount || 15) * (shares_data?.creator_share_percentage || 15) / 100,
  }

  try {
    let paymentIntentObj: any = {
      amount: returnObj.amount * 100,
      currency: returnObj.currency,
      customer: returnObj.customer,
      description: returnObj.description,
      payment_method: returnObj.payment_method,
      confirm: true,
    };

    if (creator?.stripe_account_id) {

      paymentIntentObj.transfer_data = {
        destination: creator.stripe_account_id, // ✅ Creator’s Stripe Connect ID
      };

      paymentIntentObj.application_fee_amount = Math.round((returnObj.amount - returnObj.creator_amount) * 100); // ✅ Platform cut

    }

    let s_key_env = user.stripe_env || creator?.stripe_env || "STRIPE_TEST_KEY";
    const stripe = new Stripe(Deno.env.get(s_key_env) ?? "", { apiVersion: "2020-08-27" });

    console.log(shares_data, paymentIntentObj, s_key_env)

    returnObj.transaction = await stripe.paymentIntents.create(paymentIntentObj);

    const isPaid =
      (returnObj.transaction?.status === "succeeded" ||
        returnObj.transaction?.charges?.data?.[0]?.paid === true ||
        returnObj.transaction?.charges?.data?.[0]?.status === "succeeded"
      );

    if (isPaid) {
      console.log("✅ Payment completed:", returnObj.transaction?.id);
    } else {
      console.log("❌ Payment not completed yet:", returnObj.transaction?.status);
    }

    returnObj.status = isPaid ? "Completed" : "Failed";
  } catch (err: any) {
    console.error(`❌ Stripe payment failed for user ${user.id}`, err.message);
    returnObj.rejectedData = err;
    returnObj.status = "Failed"; // don't throw
  }

  return returnObj

}