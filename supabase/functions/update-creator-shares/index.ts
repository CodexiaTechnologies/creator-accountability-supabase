// supabase/functions/create-creator-connect/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {

    const { creator_share_percentage } = await req.json();

    if (!creator_share_percentage || creator_share_percentage < 1 || creator_share_percentage > 90) {
      return new Response(JSON.stringify({ error: "creator share value should be between 1-90" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { error: updateErr } = await supabase.from("shares_settings").update({ creator_share_percentage: creator_share_percentage }).eq("id", '8de06f3c-ad57-44d8-8b04-6f536aaac2c5');
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ creator_share_percentage: creator_share_percentage }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("update-creator-shares error:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});