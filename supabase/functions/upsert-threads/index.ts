import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, ApiKey"
};

serve(async (req) => {
  console.log('step 0');
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  console.log('step 1');
  try {

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

    console.log('step 2', type, action, user_id);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    /* -------------------------------------------------------
       1️⃣ THREAD (POST)
    ------------------------------------------------------- */
    if (type === "post") {

      console.log('step 2 post');

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

        return new Response(
          JSON.stringify({ message: "Post created successfully", data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } else if (action === "update") {
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

        return new Response(
          JSON.stringify({ message: "Post updated successfully", data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (type === "comment") {

      console.log('step 2 comment');
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

        return new Response(
          JSON.stringify({ message: "Comment added successfully", data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (action === "update") {
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

        return new Response(
          JSON.stringify({ message: "Comment updated successfully", data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log('step 3');

    throw new Error("Invalid type or action");

  } catch (error) {
    console.log('step 4', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Data not created/update' }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
