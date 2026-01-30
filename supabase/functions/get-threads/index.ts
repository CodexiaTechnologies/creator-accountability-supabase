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
      limit = 100,
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
          user_id,
          title,
          description,
          tags,
          created_at,
          users ( name ),
          discussion_comments (
            id,
            user_id,
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
        user_id,
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


    const { data, error, count } = await query;

    if (error) throw error;

    let filteredData = data ?? [];

    if (searchText) {
      const search = searchText.toLowerCase().trim();

      filteredData = filteredData.filter(post => {
        const title = post.title?.toLowerCase().trim() ?? "";

        // 1️⃣ Check title includes search text
        if (title.includes(search)) return true;

        // 2️⃣ Check tags (exact match)
        if (Array.isArray(post.tags)) {
          return post.tags.some(tag =>
            tag.toLowerCase().trim() === search
          );
        }

        return false;
      });
    }

    // Transform response: add replies_count
    const threads = filteredData.map((post) => ({
      id: post.id,
      user_id: post.user_id,
      title: post.title,
      tags: post.tags,
      created_at: post.created_at,
      time_ago: timeAgo(post.created_at),
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

function timeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);

  const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "week", seconds: 604800 },
    { label: "day", seconds: 86400 },
    { label: "hr", seconds: 3600 },
    { label: "min", seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? "s" : ""} ago`;
    }
  }

  return "just now";
}