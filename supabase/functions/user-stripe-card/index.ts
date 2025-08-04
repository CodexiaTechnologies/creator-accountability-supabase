import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@12.1.0?target=deno';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe("sk_test_51Rpr1u0mDkO4nNWr2uYJ7C7jkvCMdgDncsmNFAAfmfSrZ7iExaaZtBvyyjV9qChaozhtjkAmZQ1ey9kYWSPkAfGN00yVt4SALY", { apiVersion: "2020-08-27" });

const corsHeaders = {
   'Access-Control-Allow-Origin': '*', // Allows requests from any origin
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Only allow POST and OPTIONS
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, ApiKey',
};

serve(async (req) => {

  console.log("req", req.method);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

    // Combine CORS headers with content type for the main responses
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // Attempt to parse the request body
    const { token, userId } = await req.json();

    // Input validation
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token." }), {
        status: 400,
        headers: headers,
      });
    }

    console.log("Received token:", token);
    console.log("Received userId:", userId);

    // Create a new Stripe customer
    const customer = await stripe.customers.create({
      source: token,
      description: `Customer for user ID: ${userId || "unknown"}`,
    });

    console.log("customer:", customer);

     // Initialize Supabase client with the Service Role Key
    const supabase = createClient(
      'https://swyqqttetwwjrvlcsfam.supabase.co/',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eXFxdHRldHd3anJ2bGNzZmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NTYzODUsImV4cCI6MjA2OTQzMjM4NX0.KP_4Ejbh8hPlT_QkBT7TR5x9EVPFUgkdyd18l1XK2p0'
    );

      // Dates
const startDate = new Date();
const endDate = new Date();
endDate.setDate(startDate.getDate() + 30);

// Format as YYYY-MM-DD
const formatDate = (d: Date) => d.toISOString().split("T")[0];

// Update Supabase table
const { data, error } = await supabase
  .from("users").update({
    stripe_customer_id: customer.id,
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    missed_days: 0,
    is_completed: false,
  }).eq("id", userId);

    if (error) {
      console.error("Supabase update error:", error);
      throw new Error("Failed to save customer ID to database.");
    }

    // Return the new customer's ID
    return new Response(JSON.stringify({ customerId: customer.id }), {
      status: 200,
      headers: headers,
    });

  } catch (err) {
    // Log the error for debugging on the server-side
    console.error("Error creating Stripe customer:", err);

    // Return a bad request response with CORS headers
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: headers,
    });
  }

})