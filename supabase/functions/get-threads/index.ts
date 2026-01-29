import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, ApiKey"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      postId,
      userId,
      searchText,
      limit = 10,
      offset = 0
    } = await req.json();

    /* -------------------------------------------------------
       1️⃣ If postId → return post + comments + user names
    ------------------------------------------------------- */
    if (postId) {
      const { data, error } = await supabase
        .from("discussion_posts")
        .select(`
          id,
          title,
          description,
          tags,
          created_at,
          users ( name ),
          discussion_comments (
            id,
            comment,
            created_at,
            users ( name )
          )
        `)
        .eq("id", postId)
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ post: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    /* -------------------------------------------------------
       2️⃣ Threads list (all / by user / search)
    ------------------------------------------------------- */

    let query = supabase
      .from("discussion_posts")
      .select(`
        id,
        title,
        tags,
        created_at,
        users ( name ),
        discussion_comments ( id )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by user
    if (userId) {
      query = query.eq("user_id", userId);
    }

    // Search by title OR tags
    if (searchText) {
      query = query.or(
        `title.ilike.%${searchText}%,tags.cs.{${searchText}}`
      );
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Transform response: add replies_count
    const threads = data.map((post) => ({
      id: post.id,
      title: post.title,
      tags: post.tags,
      created_at: post.created_at,
      user_name: post.users?.name ?? null,
      replies_count: post.discussion_comments?.length ?? 0
    }));

    return new Response(
      JSON.stringify({
        total: count,
        threads
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
