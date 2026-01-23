import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@12.1.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


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
    const { token, paymentMethodId, userId, stripe_customer_id, stripe_env } = await req.json();

    // Input validation
    if (!token && !paymentMethodId) {
      return new Response(JSON.stringify({ error: "Missing token." }), {
        status: 400,
        headers: headers,
      });
    }

    let s_key_env = stripe_env || "STRIPE_LIVE_KEY";

    console.log("Received token, paymentMethodId, userId:", token || '-', paymentMethodId, userId, stripe_env || '-', s_key_env);

    const stripe = new Stripe(Deno.env.get(s_key_env) ?? "", { apiVersion: "2020-08-27" });

    // Initialize Supabase client with the Service Role Key
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Create a new Stripe customer
    // const customer = await stripe.customers.create({
    //   source: token,
    //   description: `Customer for user ID: ${userId || "unknown"}`,
    // });
    // console.log("customer:", customer);

    // Check if user already has a customer
    let customerId: string;

    if (stripe_customer_id) {
      customerId = stripe_customer_id;

      // Attach the payment method to existing customer
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });

      // Set as default
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    } else {

      const customer = await stripe.customers.create({
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId },
        description: `Customer for user ID: ${userId}`,
      });
      console.log('step 2', customer)
      customerId = customer?.id || '';
    }

    // Dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 30);

    // Format as YYYY-MM-DD
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    // Update Supabase table
    const { data, error } = await supabase
      .from("users").update({
        stripe_customer_id: customerId,
        default_payment_method: paymentMethodId, // ✅ Save it
        // start_date: formatDate(startDate),
        // end_date: formatDate(endDate),
        // missed_days: 0,
        is_completed: false,
      }).eq("id", userId);

    if (error) {
      console.error("Supabase update error:", error);
      throw new Error("Failed to save customer ID to database.", userId);
    }

    // Return the new customer's ID
    return new Response(JSON.stringify({ customerId, default_payment_method: paymentMethodId }), {
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