// supabase/functions/check-creator-connect-status/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.1.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  console.log('step1')
  try {

    const { creatorId, stripe_account_id } = await req.json();
    if (!creatorId) return new Response(JSON.stringify({ error: "creatorId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    console.log('step2')

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const stripe = new Stripe(Deno.env.get("STRIPE_ASIM_TEST_KEY") ?? "", { apiVersion: "2020-08-27" });

    let stripe_id = stripe_account_id || '';
    if (!stripe_id) {
      const { data: creator } = await supabase.from("creators").select("id, stripe_account_id").eq("id", creatorId).maybeSingle();
      console.log( 'step2.2', creator)
      if (!creator || !creator.stripe_account_id) return new Response(JSON.stringify({ error: "Creator or stripe_account_id not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      else { stripe_id = creator.stripe_account_id }
    }

    console.log('step3')
    // retrieve Stripe account
    const acct = await stripe.accounts.retrieve(stripe_id);
    console.log('step4', acct)
    // update DB with important flags
    const updates: any = {
      stripe_account_status: acct?.status || acct?.details_submitted || null,
      stripe_payouts_enabled: acct?.payouts_enabled || false,
      stripe_charges_enabled: acct?.charges_enabled || false
    };

    const { data: updatedCreator, error: updateError } = await supabase.from("creators")
      .update(updates).eq("id", creatorId).select("*").single();

    if (updateError) throw updateError;

    console.log('step5')
    return new Response(JSON.stringify({ creator: updatedCreator, stripe_account: acct }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("check-status error:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
