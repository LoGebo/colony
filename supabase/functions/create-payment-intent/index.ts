// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // 1. CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: CORS_HEADERS });
  }

  // 2. Only allow POST
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  try {
    // 3. Initialize clients
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
    });

    // Service client: bypasses RLS for trusted writes
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // User client: uses caller's JWT for auth verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // 4. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // 5. Parse and validate request body
    let body: {
      unit_id?: string;
      amount?: number;
      description?: string;
      idempotency_key?: string;
      payment_method_type?: string;
    };

    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { unit_id, amount, description, idempotency_key } = body;
    const payment_method_type = body.payment_method_type ?? "card";

    if (!unit_id || amount === undefined || !description || !idempotency_key) {
      return jsonResponse(
        {
          error:
            "Missing required fields: unit_id, amount, description, idempotency_key",
        },
        400
      );
    }

    // Basic amount sanity check (Stripe-level validation follows)
    if (typeof amount !== "number" || amount <= 0) {
      return jsonResponse(
        { error: "amount must be a positive number" },
        400
      );
    }

    if (amount > 999999.99) {
      return jsonResponse(
        { error: "amount exceeds maximum allowed (999999.99 MXN)" },
        400
      );
    }

    // 6. Get user's resident record
    // residents.id is a business ID; residents.user_id links to auth.users
    const { data: resident, error: residentError } = await serviceClient
      .from("residents")
      .select("id, community_id, user_id, deleted_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (residentError || !resident) {
      return jsonResponse(
        { error: "Forbidden: user is not an active resident" },
        403
      );
    }

    // 7. Verify resident has an active occupancy in the target unit
    const { data: occupancy, error: occupancyError } = await serviceClient
      .from("occupancies")
      .select("id")
      .eq("resident_id", resident.id)
      .eq("unit_id", unit_id)
      .is("deleted_at", null)
      .single();

    if (occupancyError || !occupancy) {
      return jsonResponse(
        { error: "Forbidden: resident has no active occupancy in this unit" },
        403
      );
    }

    // 8. Validate amount against unit balance
    // unit_balances view uses total_receivable column (NOT current_balance)
    const { data: balance, error: balanceError } = await serviceClient
      .from("unit_balances")
      .select("total_receivable")
      .eq("unit_id", unit_id)
      .single();

    if (balanceError) {
      return jsonResponse(
        { error: "Failed to retrieve unit balance" },
        500
      );
    }

    const totalReceivable = balance?.total_receivable ?? 0;

    if (amount > totalReceivable) {
      return jsonResponse(
        {
          error: "Amount exceeds outstanding balance",
          outstanding_balance: totalReceivable,
        },
        422
      );
    }

    // 9. Get or create Stripe Customer for this resident+unit combination
    const { data: existingCustomer } = await serviceClient
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("resident_id", resident.id)
      .eq("unit_id", unit_id)
      .is("deleted_at", null)
      .single();

    let stripeCustomerId: string;

    if (existingCustomer?.stripe_customer_id) {
      stripeCustomerId = existingCustomer.stripe_customer_id;
    } else {
      // Create a new Stripe Customer
      const stripeCustomer = await stripe.customers.create({
        email: user.email,
        name: user.email, // Display name; can be updated via profile sync later
        metadata: {
          community_id: resident.community_id,
          resident_id: resident.id,
          unit_id: unit_id,
        },
      });

      stripeCustomerId = stripeCustomer.id;

      // Persist the new customer mapping
      const { error: insertCustomerError } = await serviceClient
        .from("stripe_customers")
        .insert({
          community_id: resident.community_id,
          resident_id: resident.id,
          unit_id: unit_id,
          stripe_customer_id: stripeCustomerId,
          email: user.email,
        });

      if (insertCustomerError) {
        // If UNIQUE constraint violation (race condition), fetch the existing one
        if (insertCustomerError.code === "23505") {
          const { data: racedCustomer } = await serviceClient
            .from("stripe_customers")
            .select("stripe_customer_id")
            .eq("resident_id", resident.id)
            .eq("unit_id", unit_id)
            .is("deleted_at", null)
            .single();

          if (racedCustomer?.stripe_customer_id) {
            stripeCustomerId = racedCustomer.stripe_customer_id;
          } else {
            return jsonResponse(
              { error: "Failed to create Stripe customer" },
              500
            );
          }
        } else {
          return jsonResponse(
            { error: "Failed to save Stripe customer" },
            500
          );
        }
      }
    }

    // 10. Create Stripe PaymentIntent
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount * 100), // Stripe uses centavos (integer)
      currency: "mxn",
      customer: stripeCustomerId,
      description: description,
      payment_method_types:
        payment_method_type === "oxxo" ? ["oxxo"] : ["card"],
      metadata: {
        community_id: resident.community_id,
        unit_id: unit_id,
        resident_id: resident.id,
        idempotency_key: idempotency_key,
      },
    };

    // OXXO-specific: set voucher expiry window
    if (payment_method_type === "oxxo") {
      paymentIntentParams.payment_method_options = {
        oxxo: { expires_after_days: 2 },
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(
      paymentIntentParams,
      { idempotencyKey: idempotency_key }
    );

    // 11. Insert payment_intents record
    // expires_at: 48 hours from now for OXXO; null for card
    const expiresAt =
      payment_method_type === "oxxo"
        ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
        : null;

    const { error: insertIntentError } = await serviceClient
      .from("payment_intents")
      .insert({
        community_id: resident.community_id,
        unit_id: unit_id,
        resident_id: resident.id,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_customer_id: stripeCustomerId,
        amount: amount,
        currency: "MXN",
        status: paymentIntent.status,
        payment_method_type: payment_method_type,
        description: description,
        idempotency_key: idempotency_key,
        metadata: {
          stripe_created: paymentIntent.created,
          payment_method_types: paymentIntent.payment_method_types,
        },
        expires_at: expiresAt,
      });

    if (insertIntentError) {
      // UNIQUE(idempotency_key) violation means this is a duplicate request
      if (insertIntentError.code === "23505") {
        // Idempotent: fetch the existing payment intent and return its details
        const { data: existingIntent } = await serviceClient
          .from("payment_intents")
          .select("stripe_payment_intent_id, stripe_customer_id, status")
          .eq("idempotency_key", idempotency_key)
          .single();

        if (existingIntent) {
          // Re-fetch client_secret from Stripe since we don't store it
          const existingPi = await stripe.paymentIntents.retrieve(
            existingIntent.stripe_payment_intent_id
          );

          return jsonResponse(
            {
              clientSecret: existingPi.client_secret,
              paymentIntentId: existingPi.id,
              customerId: existingIntent.stripe_customer_id,
              status: existingPi.status,
              duplicate: true,
            },
            200
          );
        }
      }

      return jsonResponse(
        { error: "Failed to save payment intent" },
        500
      );
    }

    // 12. Return success response
    return jsonResponse(
      {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        customerId: stripeCustomerId,
        status: paymentIntent.status,
      },
      201
    );
  } catch (err: unknown) {
    // Stripe-specific error handling
    if (err && typeof err === "object" && "type" in err) {
      const stripeErr = err as Stripe.errors.StripeError;

      if (stripeErr.type === "StripeRateLimitError") {
        return jsonResponse(
          { error: "Rate limit exceeded. Please retry shortly." },
          429
        );
      }

      if (
        stripeErr.type === "StripeCardError" ||
        stripeErr.type === "StripeInvalidRequestError"
      ) {
        return jsonResponse({ error: stripeErr.message }, 400);
      }

      if (
        stripeErr.type === "StripeAuthenticationError" ||
        stripeErr.type === "StripePermissionError"
      ) {
        // Stripe API key misconfiguration - don't expose details
        console.error("Stripe auth error:", stripeErr.message);
        return jsonResponse({ error: "Payment service configuration error" }, 500);
      }
    }

    // Generic server error - log but don't leak details
    console.error("create-payment-intent error:", err);
    return jsonResponse(
      { error: "Internal server error" },
      500
    );
  }
});
