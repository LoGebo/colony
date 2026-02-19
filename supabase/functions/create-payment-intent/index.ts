import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

// CORS: wildcard is acceptable for mobile API endpoints (React Native does not
// use browser CORS). Supabase Edge Functions are not called from web browsers.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_PAYMENT_METHODS = ["card", "oxxo", "spei"] as const;
const MIN_AMOUNT_CENTAVOS = 1000; // MXN $10.00 minimum (Stripe MXN minimum)
const MAX_AMOUNT_CENTAVOS = 99999999; // MXN $999,999.99
const MAX_OXXO_AMOUNT_CENTAVOS = 1000000; // MXN $10,000.00 (OXXO limit)

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
    // 3. Authenticate FIRST — no privileged clients before auth is confirmed
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // 4. Initialize privileged clients AFTER auth confirmation
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 5. Parse and validate request body
    let body: {
      unit_id?: string;
      amount?: number;
      description?: string;
      idempotency_key?: string;
      payment_method_type?: string;
      enable_installments?: boolean;
    };

    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { unit_id, amount, description, idempotency_key } = body;
    const payment_method_type = body.payment_method_type ?? "card";

    // Required fields
    if (!unit_id || amount === undefined || !description || !idempotency_key) {
      return jsonResponse(
        {
          error:
            "Missing required fields: unit_id, amount, description, idempotency_key",
        },
        400,
      );
    }

    // Format validation
    if (!UUID_REGEX.test(unit_id)) {
      return jsonResponse({ error: "unit_id must be a valid UUID" }, 400);
    }

    if (!UUID_REGEX.test(idempotency_key)) {
      return jsonResponse(
        { error: "idempotency_key must be a valid UUID" },
        400,
      );
    }

    if (
      !VALID_PAYMENT_METHODS.includes(
        payment_method_type as (typeof VALID_PAYMENT_METHODS)[number],
      )
    ) {
      return jsonResponse(
        { error: "payment_method_type must be 'card', 'oxxo', or 'spei'" },
        400,
      );
    }

    if (typeof description !== "string" || description.length > 1000) {
      return jsonResponse(
        { error: "description must be a string of at most 1000 characters" },
        400,
      );
    }

    // Amount validation — work in integer centavos to avoid floating-point issues
    if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
      return jsonResponse(
        { error: "amount must be a positive number" },
        400,
      );
    }

    const amountCentavos = Math.round(amount * 100);

    if (amountCentavos < MIN_AMOUNT_CENTAVOS) {
      return jsonResponse(
        { error: `Minimum payment is $${(MIN_AMOUNT_CENTAVOS / 100).toFixed(2)} MXN` },
        400,
      );
    }

    if (amountCentavos > MAX_AMOUNT_CENTAVOS) {
      return jsonResponse(
        { error: "amount exceeds maximum allowed (999999.99 MXN)" },
        400,
      );
    }

    if (payment_method_type === "oxxo" && amountCentavos > MAX_OXXO_AMOUNT_CENTAVOS) {
      return jsonResponse(
        { error: "OXXO payments are limited to $10,000.00 MXN" },
        400,
      );
    }

    // 5b. OXXO requires a valid email for billing details (check early, before Stripe Customer creation)
    if (payment_method_type === "oxxo" && !user.email) {
      return jsonResponse(
        { error: "OXXO payments require an email address on your account" },
        422,
      );
    }

    // 6. Get user's resident record (with name for Stripe customer)
    // residents.id is a business ID; residents.user_id links to auth.users
    const { data: resident, error: residentError } = await serviceClient
      .from("residents")
      .select("id, community_id, user_id, first_name, paternal_surname")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (residentError || !resident) {
      return jsonResponse(
        { error: "Forbidden: user is not an active resident" },
        403,
      );
    }

    // 7. Verify resident has an active occupancy in the target unit
    const { data: occupancy, error: occupancyError } = await serviceClient
      .from("occupancies")
      .select("id")
      .eq("resident_id", resident.id)
      .eq("unit_id", unit_id)
      .eq("status", "active")
      .is("deleted_at", null)
      .single();

    if (occupancyError || !occupancy) {
      return jsonResponse(
        { error: "Forbidden: resident has no active occupancy in this unit" },
        403,
      );
    }

    // 8. Validate amount against unit balance (compare in centavos)
    // unit_balances view uses total_receivable column (NOT current_balance)
    const { data: balance, error: balanceError } = await serviceClient
      .from("unit_balances")
      .select("total_receivable")
      .eq("unit_id", unit_id)
      .single();

    if (balanceError) {
      return jsonResponse(
        { error: "Failed to retrieve unit balance" },
        500,
      );
    }

    const totalReceivable = Number(balance?.total_receivable ?? 0);
    const totalReceivableCentavos = Math.round(totalReceivable * 100);

    if (amountCentavos > totalReceivableCentavos) {
      return jsonResponse(
        {
          error: "Amount exceeds outstanding balance",
          outstanding_balance: totalReceivable,
        },
        422,
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
      // Use resident's actual name for Stripe, fallback to email
      const displayName =
        resident.first_name && resident.paternal_surname
          ? `${resident.first_name} ${resident.paternal_surname}`
          : (user.email ?? "");

      const stripeCustomer = await stripe.customers.create({
        email: user.email,
        name: displayName,
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
              500,
            );
          }
        } else {
          return jsonResponse(
            { error: "Failed to save Stripe customer" },
            500,
          );
        }
      }
    }

    // 10. Create Stripe PaymentIntent
    const paymentMethodTypes: string[] =
      payment_method_type === "oxxo"
        ? ["oxxo"]
        : payment_method_type === "spei"
          ? ["customer_balance"]
          : ["card"];

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountCentavos,
      currency: "mxn",
      customer: stripeCustomerId,
      description: description,
      payment_method_types: paymentMethodTypes,
      // Save card for future payments (only for card — OXXO/SPEI are one-time)
      ...(payment_method_type === "card" ? { setup_future_usage: "off_session" } : {}),
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

    // SPEI-specific: configure bank transfer funding
    if (payment_method_type === "spei") {
      paymentIntentParams.payment_method_data = {
        type: "customer_balance",
      } as Stripe.PaymentIntentCreateParams.PaymentMethodData;
      paymentIntentParams.payment_method_options = {
        customer_balance: {
          funding_type: "bank_transfer",
          bank_transfer: {
            type: "mx_bank_transfer",
          },
        },
      };
      paymentIntentParams.confirm = true;
    }

    // MSI (installments): enable when requested for card payments
    if (payment_method_type === "card" && body.enable_installments) {
      paymentIntentParams.payment_method_options = {
        ...paymentIntentParams.payment_method_options,
        card: {
          installments: { enabled: true },
        },
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(
      paymentIntentParams,
      { idempotencyKey: idempotency_key },
    );

    // 11. Insert payment_intents record
    // expires_at: 48 hours from Stripe's created timestamp for OXXO; null for card
    // Uses paymentIntent.created (unix seconds) from Stripe as source of truth
    const expiresAt =
      payment_method_type === "oxxo"
        ? new Date((paymentIntent.created + 2 * 24 * 60 * 60) * 1000).toISOString()
        : payment_method_type === "spei"
          ? new Date((paymentIntent.created + 3 * 24 * 60 * 60) * 1000).toISOString()
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
        // Idempotent: fetch the existing intent — verify resident_id ownership
        const { data: existingIntent } = await serviceClient
          .from("payment_intents")
          .select("stripe_payment_intent_id, stripe_customer_id, status")
          .eq("idempotency_key", idempotency_key)
          .eq("resident_id", resident.id)
          .single();

        if (existingIntent) {
          // Re-fetch client_secret from Stripe since we don't store it
          const existingPi = await stripe.paymentIntents.retrieve(
            existingIntent.stripe_payment_intent_id,
          );

          return jsonResponse(
            {
              clientSecret: existingPi.client_secret,
              paymentIntentId: existingPi.id,
              customerId: existingIntent.stripe_customer_id,
              status: existingPi.status,
            },
            200,
          );
        }
      }

      return jsonResponse(
        { error: "Failed to save payment intent" },
        500,
      );
    }

    // 12. Return success response
    // For SPEI: include bank transfer instructions from next_action
    const responseBody: Record<string, unknown> = {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      customerId: stripeCustomerId,
      status: paymentIntent.status,
    };

    if (payment_method_type === "spei" && paymentIntent.next_action) {
      const bankTransfer = (
        paymentIntent.next_action as { display_bank_transfer_instructions?: {
          financial_addresses?: Array<{
            type: string;
            spei?: { bank_name: string; clabe: string };
          }>;
          reference?: string;
          amount_remaining?: number;
        } }
      ).display_bank_transfer_instructions;

      if (bankTransfer) {
        const speiAddress = bankTransfer.financial_addresses?.find(
          (a) => a.type === "spei",
        );
        responseBody.bankTransfer = {
          clabe: speiAddress?.spei?.clabe ?? null,
          bankName: speiAddress?.spei?.bank_name ?? null,
          reference: bankTransfer.reference ?? null,
          amountRemaining: bankTransfer.amount_remaining ?? amountCentavos,
        };
      }
    }

    return jsonResponse(responseBody, 201);
  } catch (err: unknown) {
    // Stripe-specific error handling
    if (err && typeof err === "object" && "type" in err) {
      const stripeErr = err as { type: string; message?: string };

      if (stripeErr.type === "StripeRateLimitError") {
        return jsonResponse(
          { error: "Rate limit exceeded. Please retry shortly." },
          429,
        );
      }

      if (stripeErr.type === "StripeCardError") {
        // Card errors are user-visible (decline messages)
        return jsonResponse({ error: stripeErr.message }, 400);
      }

      if (stripeErr.type === "StripeInvalidRequestError") {
        // Don't leak Stripe internal details
        console.error("Stripe invalid request:", stripeErr.message);
        return jsonResponse({ error: "Invalid payment request" }, 400);
      }

      if (
        stripeErr.type === "StripeAuthenticationError" ||
        stripeErr.type === "StripePermissionError"
      ) {
        console.error("Stripe auth error:", stripeErr.message);
        return jsonResponse(
          { error: "Payment service configuration error" },
          500,
        );
      }
    }

    // Generic server error - log but don't leak details
    console.error("create-payment-intent error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
