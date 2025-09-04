import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ✅ CORS setup
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, ApiKey",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const { email, password, full_name } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required." }),
        { status: 400, headers }
      );
    }

    // ✅ Init Supabase with Service Role Key (make sure you add it in project)
  const supabase = createClient(
    'https://swyqqttetwwjrvlcsfam.supabase.co/',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eXFxdHRldHd3anJ2bGNzZmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NTYzODUsImV4cCI6MjA2OTQzMjM4NX0.KP_4Ejbh8hPlT_QkBT7TR5x9EVPFUgkdyd18l1XK2p0'
  );

    // ✅ Create Auth user
    const { data: userData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "creator", full_name },
    });

    console.log(userData)
    console.log(authError)

    if (authError) {
      console.error("Auth error:", authError.message);
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers,
      });
    }

    const newUser = userData.user;
    const creator_slug = generateCreatorSlug(full_name, email, 127);

    // After inserting new creator row, get back serial_no
const { data: creatorData, error: dbError } = await supabase
  .from("creators")
  .insert({ auth_user_id: newUser.id, email, full_name })
  .select("id, serial_no, email, full_name")
  .single();

      console.log(creatorData)
    console.log(dbError)

if (dbError) throw dbError;

      const creator_slug = generateCreatorSlug(full_name, email, creatorData.serial_no);

// Now update row with final url_id
await supabase.from("creators")
  .update({ creator_url_id: creator_username })
  .eq("id", creatorData.id);


    return new Response(JSON.stringify({ creator: creatorData }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers,
    });
  }
});


function generateCreatorSlug(full_name: string | null, email: string, serial: number): string {
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