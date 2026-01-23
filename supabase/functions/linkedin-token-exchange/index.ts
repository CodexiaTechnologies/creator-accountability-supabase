import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(jwt);

    if (!user) {
      return new Response("Invalid session", { status: 401, headers: corsHeaders });
    }

    const { code, redirectUrl } = await req.json();

    console.log(redirectUrl, code);
    if (!code) {
      return new Response("Missing code", { status: 400, headers: corsHeaders });
    }

    /* -----------------------------
       Exchange code → access token
    ------------------------------*/
    const tokenRes = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: Deno.env.get("LINKEDIN_CLIENT_ID")!,
          client_secret: Deno.env.get("LINKEDIN_CLIENT_SECRET")!,
          redirect_uri: redirectUrl || `${Deno.env.get("WEB_URL")}/linkedin-callback`,
        }),
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error(tokenData);
      return new Response("Token exchange failed", { status: 400, headers: corsHeaders });
    }

    /* -----------------------------
       Save token securely
    ------------------------------*/
    await supabase.from("linkedin_tokens").upsert({
      user_id: user.id,
      access_token: tokenData.access_token,
      expires_at: new Date(
        Date.now() + tokenData.expires_in * 1000
      ).toISOString(),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    });
  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500, headers: corsHeaders });
  }
});
