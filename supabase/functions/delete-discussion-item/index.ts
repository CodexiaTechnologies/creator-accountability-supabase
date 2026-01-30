import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, ApiKey",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {

    const { type, id } = await req.json();

    if (!type || !id) {
      throw new Error("type and id are required");
    }

        const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let result;

    if (type === "post") {
      // Comments will be deleted via DB trigger
      result = await supabase
        .from("discussion_posts")
        .delete()
        .eq("id", id);
    } 
    else if (type === "comment") {
      result = await supabase
        .from("discussion_comments")
        .delete()
        .eq("id", id);
    } else {
      throw new Error("Invalid type. Use 'post' or 'comment'");
    }

    if (result.error) throw result.error;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
