import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.1.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  console.log('step1')
  try {

    const { userId, stripe_account_id, stripe_env } = await req.json();
    if (!userId) return new Response(JSON.stringify({ error: "userId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    console.log('step2')

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    let s_key_env = stripe_env || "";
    let stripe_id = stripe_account_id || '';

    if (!stripe_id || !s_key_env) {
      const { data: user } = await supabase.from("users").select("id, stripe_account_id, stripe_env").eq("id", userId).maybeSingle();
      console.log( 'step2.2', userId)
      if (!user || !user.stripe_account_id) return new Response(JSON.stringify({ error: "User or stripe_account_id not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      else { 
        stripe_id = user.stripe_account_id;
        s_key_env = user.stripe_env || "STRIPE_TEST_KEY";
      }
    }

    console.log(s_key_env);
    const stripe = new Stripe(Deno.env.get( s_key_env ) ?? "", { apiVersion: "2020-08-27" });

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

    const { data: updatedUser, error: updateError } = await supabase.from("users")
      .update(updates).eq("id", userId).select("*").single();

    if (updateError) throw updateError;

    console.log('step5')
    return new Response(JSON.stringify({ user: updatedUser, stripe_account: acct }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("check-status error:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
