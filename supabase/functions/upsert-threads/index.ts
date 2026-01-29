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
      type,
      action,
      user_id,

      // Post
      post_id,
      title,
      description,
      tags,

      // Comment
      comment_id,
      comment,
    } = await req.json();

    if (!type || !action || !user_id) {
      throw new Error("type, action and user_id are required");
    }

    /* -------------------------------------------------------
       1️⃣ THREAD (POST)
    ------------------------------------------------------- */
    if (type === "post") {

      if (action === "create") {
        if (!title) throw new Error("title is required");

        const { data, error } = await supabase
          .from("discussion_posts")
          .insert({
            user_id,
            title,
            description,
            tags
          })
          .select()
          .single();

        if (error) throw error;

        return success("Post created successfully", data);
      }

      if (action === "update") {
        if (!post_id) throw new Error("post_id is required for update");

        const { data, error } = await supabase
          .from("discussion_posts")
          .update({
            title,
            description,
            tags,
            updated_at: new Date().toISOString()
          })
          .eq("id", post_id)
          .eq("user_id", user_id) // ownership check
          .select()
          .single();

        if (error) throw error;

        return success("Post updated successfully", data);
      }
    }

    /* -------------------------------------------------------
       2️⃣ COMMENT
    ------------------------------------------------------- */
    if (type === "comment") {

      if (action === "create") {
        if (!post_id || !comment) {
          throw new Error("post_id and comment are required");
        }

        const { data, error } = await supabase
          .from("discussion_comments")
          .insert({
            post_id,
            user_id,
            comment
          })
          .select()
          .single();

        if (error) throw error;

        return success("Comment added successfully", data);
      }

      if (action === "update") {
        if (!comment_id) {
          throw new Error("comment_id is required for update");
        }

        const { data, error } = await supabase
          .from("discussion_comments")
          .update({
            comment,
            updated_at: new Date().toISOString()
          })
          .eq("id", comment_id)
          .eq("user_id", user_id) // ownership check
          .select()
          .single();

        if (error) throw error;

        return success("Comment updated successfully", data);
      }
    }

    throw new Error("Invalid type or action");

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

/* -------------------------------------------------------
   Helper
------------------------------------------------------- */
function success(message: string, data: any) {
  return new Response(
    JSON.stringify({ message, data }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
