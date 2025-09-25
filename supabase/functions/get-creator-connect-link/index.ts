// supabase/functions/create-creator-connect/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.1.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  console.log('step1')
  try {

    const { creatorId, email, stripe_account_id } = await req.json();

    if (!creatorId) {
      return new Response(JSON.stringify({ error: "creatorId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const stripe = new Stripe(Deno.env.get("STRIPE_ASIM_TEST_KEY") ?? "", { apiVersion: "2020-08-27" });

    console.log('step2')
    let accountId = stripe_account_id;

    // 2. If account doesn't exist yet, create one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: email,
        // optional: country, business_type, capabilities, etc.
      });

      accountId = account?.id || '';
      console.log('step3', accountId)
      // store account id in DB
      const { error: updateErr } = await supabase
        .from("creators")
        .update({ stripe_account_id: accountId, stripe_account_status: account.status })
        .eq("id", creatorId);

      if (updateErr) throw updateErr;
      console.log('step4')
    }

    // 3. Create an account link (onboarding) for Express account
    const refreshUrl = `${Deno.env.get("CREATOR_URL")}/dashboard?onboard=refresh`;
    const returnUrl = `${Deno.env.get("CREATOR_URL")}/dashboard?onboard=success`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    console.log('step5')

    // Save onboard url till used (optional)
    await supabase.from("creators").update({ stripe_onboard_url: accountLink.url }).eq("id", creatorId);
    console.log('step6')
    return new Response(JSON.stringify({ url: accountLink.url, accountId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("create-creator-connect error:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
