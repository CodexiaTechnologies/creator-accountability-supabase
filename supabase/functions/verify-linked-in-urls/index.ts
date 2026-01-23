import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
const LINKEDIN_POST_REGEX = /activity-(\d+)/;
const LINKEDIN_COMMENT_REGEX = /commentUrn=urn:li:comment:\((\d+),(\d+)\)/;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, ApiKey',
};

function isToday(timestamp: number): boolean {
  const today = new Date();
  const date = new Date(timestamp);

  return (
    today.getUTCFullYear() === date.getUTCFullYear() &&
    today.getUTCMonth() === date.getUTCMonth() &&
    today.getUTCDate() === date.getUTCDate()
  );
}

async function fetchUGC(activityId: string, token: string) {
  // const res = await fetch(
  //   `https://api.linkedin.com/v2/ugcPosts/${activityId}`,
  //   {
  //     headers: {
  //       Authorization: `Bearer ${token}`,
  //       "X-Restli-Protocol-Version": "2.0.0"
  //     }
  //   }
  // );
  // if (!res.ok) {
  //   throw new Error("Failed to fetch UGC post");
  // }
  // return res.json();

  const res = await fetch(
    `https://api.linkedin.com/v2/activities/${activityId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    }
  );

  const text = await res.text(); // 👈 capture error details

  if (!res.ok) {
    console.error("LinkedIn API error:", {
      status: res.status,
      body: text,
    });

    throw new Error(
      `LinkedIn API failed (${res.status}): ${text}`
    );
  }

  return JSON.parse(text);
}


serve(async (req) => {

  // Handle preflight OPTIONS requests from cron services
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const {
      linkedinUserId,
      accessToken,
      postUrl,
      commentUrls = []
    } = await req.json();

    if (!linkedinUserId || !accessToken || !postUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('step 1');
    /* -------------------------------
       STEP 2: Verify Post Ownership
    --------------------------------*/

    const match = postUrl.match(LINKEDIN_POST_REGEX);
    const activityId = match ? match[1] : null;
    if (!activityId) {
      return new Response(
        JSON.stringify({ error: "Unable to extract post ID" }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('step 2', activityId);

    const post = await fetchUGC(activityId, accessToken);

    const authorId = post.author?.replace("urn:li:person:", "");
    const createdTime = post.created?.time;

    const postValid =
      authorId === linkedinUserId &&
      createdTime &&
      isToday(createdTime);

    console.log('step 2.5', 'postValid: ' + postValid, 'authorId: ' + authorId, 'linkedinUserId: ' + linkedinUserId, 'createdTime: ' + createdTime);

    /* -------------------------------
       STEP 3: Comments (LIMITED)
       LinkedIn does NOT reliably allow
       comment fetch by URL.
    --------------------------------*/
    const commentsResult = commentUrls.map((url) => ({
      url,
      verified: false,
      reason: "LinkedIn does not reliably expose comment lookup via API"
    }));

    let returnObj = {
      post: {
        url: postUrl,
        activityId,
        ownerVerified: authorId === linkedinUserId,
        dateVerified: isToday(createdTime),
        valid: postValid
      },
      comments: commentsResult
    }

    console.log(returnObj);
    /* -------------------------------
       RESPONSE
    --------------------------------*/
    return new Response(
      JSON.stringify(returnObj),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
