import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, ApiKey"
};
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, usersCreatedAt } = await req.json();
    if (!userId) throw new Error("User ID is required");

    // 1. Fetch User Stats & Details
    const statsPromise = supabase
      .from('user_stats')
      .select(`
        *,
        users ( name, profile_image )
      `)
      .eq('user_id', userId)
      .maybeSingle();

    // 2. Fetch Top 10 Leaderboard
    const leaderboardPromise = supabase
      .from('user_stats')
      .select(`
        current_streak,
        total_money_earned,
        users ( name, profile_image )
      `)
      .order('current_streak', { ascending: false })
      .limit(10);

    // 3. Calculate Current User Rank
    // (Count how many users have a higher streak than this user)
    const rankPromise = supabase.rpc('get_user_rank', { u_id: userId });

    // 4. Fetch Last 30 Days Submissions
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const submissionsPromise = supabase
      .from('user_post_submissions')
      .select('created_at, status')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    // Execute all queries in parallel for maximum speed
    const [statsRes, leaderboardRes, rankRes, submissionsRes] = await Promise.all([
      statsPromise,
      leaderboardPromise,
      rankPromise,
      submissionsPromise
    ]);

    // 5. Generate Dynamic Calendar
    const signupDate = usersCreatedAt ? new Date(usersCreatedAt) : new Date();
    const activityData = formatDynamicActivity(signupDate, submissionsRes.data || []);

    return new Response(
      JSON.stringify({
        stats: statsRes.data,
        leaderboard: leaderboardRes.data,
        userRank: rankRes.data,
        activity: activityData.result,
        isTodayPosted: activityData.todayPosted
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

// Helper function to map last 30 days
/**
 * Generates 30 days of activity starting from signupDate
 */
// function formatDynamicActivity(signupDate: Date, submissions: any[]) {
//   const result = [];
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);
//   let isTodayPosted = false;

//   // Normalize signup date to start of day
//   const startDate = new Date(signupDate);
//   startDate.setHours(0, 0, 0, 0);

//   for (let i = 0; i < 30; i++) {
//     const targetDate = new Date(startDate);
//     targetDate.setDate(startDate.getDate() + i);
    
//     const dateStr = targetDate.toISOString().split('T')[0];
//     const isToday = targetDate.getTime() === today.getTime();
//     const isFuture = targetDate.getTime() > today.getTime();

//     // Check if user submitted on this specific date
//     const sub = submissions.find(s => s.created_at.startsWith(dateStr));

//     let status = 'missed';
//     if (isFuture) {
//       status = 'future';
//     } else if (sub) {
//       status = (sub.status.toLowerCase() === 'rejected') ? 'missed' : 'submitted';
//     }

//     if(isToday) {
//       if(status=='missed' ) { status ='today' } 
//       else { isTodayPosted = true }
//     }

//     result.push({
//       date: dateStr,
//       status: status,
//     });
//   }
//   return {result: result, todayPosted: isTodayPosted};
// }

function formatDynamicActivity(signupDate: Date, submissions: any[]) {
  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let isTodayPosted = false;

  // 1. Calculate the cutoff for "30 days ago"
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29); // 29 + today = 30 days total

  // 2. Determine the anchor point
  // If signup was > 30 days ago, start from 30 days ago. 
  // Otherwise, start from the signup date.
  let startDate = new Date(signupDate);
  startDate.setHours(0, 0, 0, 0);

  if (startDate < thirtyDaysAgo) {
    startDate = thirtyDaysAgo;
  }

  // 3. Loop 30 times (or until we hit the 30-day limit)
  for (let i = 0; i < 30; i++) {
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + i);
    
    const dateStr = targetDate.toISOString().split('T')[0];
    const isToday = targetDate.getTime() === today.getTime();
    const isFuture = targetDate.getTime() > today.getTime();

    // Check if user submitted on this specific date
    const sub = submissions.find(s => s.created_at.startsWith(dateStr));

    let status = 'missed';
    if (isFuture) {
      status = 'future';
    } else if (sub) {
      status = (sub.status.toLowerCase() === 'rejected') ? 'missed' : 'submitted';
    }

    if (isToday) {
      if (status === 'missed') { 
        status = 'today'; 
      } else { 
        isTodayPosted = true; 
      }
    }

    result.push({
      date: dateStr,
      status: status,
      isToday: isToday // Useful to have this boolean for frontend styling
    });
  }
  
  return { result: result, todayPosted: isTodayPosted };
}