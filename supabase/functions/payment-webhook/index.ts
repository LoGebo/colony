import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { timingSafeEqual } from "jsr:@std/crypto/timing-safe-equal";

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ---------------------------------------------------------------------------
// Stripe signature verification (timing-safe, replay-attack resistant)
// ---------------------------------------------------------------------------

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
  toleranceSeconds: number = 300 // 5 minutes
): Promise<{ verified: boolean; event?: any; error?: string }> {
  // Parse Stripe-Signature header format: t=timestamp,v1=signature
  const parts = sigHeader.split(",");
  const timestampStr = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signature = parts.find((p) => p.startsWith("v1="))?.slice(3);

  if (!timestampStr || !signature) {
    return { verified: false, error: "Invalid signature header format" };
  }

  const timestamp = parseInt(timestampStr, 10);
  const now = Math.floor(Date.now() / 1000);

  // Reject events outside tolerance window (prevent replay attacks)
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return {
      verified: false,
      error: `Timestamp outside tolerance: ${Math.abs(now - timestamp)}s`,
    };
  }

  // Compute expected HMAC-SHA256(timestamp + "." + payload)
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  const expectedSignature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Timing-safe comparison using Deno standard library
  const expectedBytes = encoder.encode(expectedSignature);
  const receivedBytes = encoder.encode(signature);

  if (expectedBytes.length !== receivedBytes.length) {
    return { verified: false, error: "Signature length mismatch" };
  }

  const isValid = timingSafeEqual(expectedBytes, receivedBytes);
  if (!isValid) {
    return { verified: false, error: "Signature verification failed" };
  }

  try {
    const event = JSON.parse(payload);
    return { verified: true, event };
  } catch {
    return { verified: false, error: "Invalid JSON payload" };
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * payment_intent.succeeded
 * - Updates payment_intents status to 'succeeded'
 * - Calls record_payment() RPC to create double-entry ledger entries
 * - Stores the returned transaction_id in payment_intents
 * - Sends push notification to the resident (non-critical, try/catch wrapped)
 */
async function handlePaymentIntentSucceeded(
  event: any
): Promise<{ success: boolean; transaction_id?: string; error?: string }> {
  const pi = event.data.object;
  const piId: string = pi.id;
  const amount: number = pi.amount; // centavos (smallest currency unit)
  const metadata = pi.metadata ?? {};

  const communityId: string | undefined = metadata.community_id;
  const unitId: string | undefined = metadata.unit_id;
  const residentId: string | undefined = metadata.resident_id;

  if (!communityId || !unitId) {
    console.error(`payment_intent.succeeded missing metadata for ${piId}`, {
      communityId,
      unitId,
    });
    return {
      success: false,
      error: "Missing required metadata: community_id or unit_id",
    };
  }

  // 1. Update payment_intents status -> succeeded
  const { error: updateError } = await supabase
    .from("payment_intents")
    .update({ status: "succeeded" })
    .eq("stripe_payment_intent_id", piId);

  if (updateError) {
    console.error(`Failed to update payment_intent status for ${piId}:`, updateError);
    // Non-fatal: continue to record payment
  }

  // 2. Call record_payment() RPC
  //    Amount from Stripe is in centavos -> divide by 100 for MXN pesos
  const { data: transactionId, error: rpcError } = await supabase.rpc(
    "record_payment",
    {
      p_community_id: communityId,
      p_unit_id: unitId,
      p_amount: amount / 100,
      p_payment_date: new Date().toISOString().split("T")[0],
      p_description: `Pago con tarjeta via Stripe - ${piId}`,
      p_payment_method_id: null, // Stripe is not a row in payment_methods table
      p_created_by: residentId ?? null, // CRITICAL: audit trail
    }
  );

  if (rpcError) {
    console.error(`record_payment() failed for ${piId}:`, rpcError);
    return { success: false, error: `record_payment failed: ${rpcError.message}` };
  }

  if (!transactionId) {
    console.error(`record_payment() returned null for ${piId}`);
    return { success: false, error: "record_payment returned null transaction_id" };
  }

  // 3. Store transaction_id in payment_intents for traceability
  const { error: txUpdateError } = await supabase
    .from("payment_intents")
    .update({ transaction_id: transactionId })
    .eq("stripe_payment_intent_id", piId);

  if (txUpdateError) {
    console.error(`Failed to store transaction_id on payment_intent ${piId}:`, txUpdateError);
    // Non-fatal: payment is recorded, just the FK link is missing
  }

  // 4. Send push notification (non-critical)
  if (residentId) {
    try {
      // Look up the resident's auth user_id
      const { data: resident, error: residentError } = await supabase
        .from("residents")
        .select("user_id")
        .eq("id", residentId)
        .maybeSingle();

      if (residentError) {
        console.warn(`Could not look up resident ${residentId} for push:`, residentError);
      } else if (resident?.user_id) {
        const amountFormatted = (amount / 100).toFixed(2);
        const { error: pushError } = await supabase.functions.invoke("send-push", {
          body: {
            user_id: resident.user_id,
            title: "Pago recibido",
            body: `Tu pago de $${amountFormatted} ha sido procesado`,
          },
        });
        if (pushError) {
          console.warn(`Push notification failed for resident ${residentId}:`, pushError);
        }
      }
    } catch (pushErr) {
      // Push is non-critical - log and continue
      console.warn(`Push notification error for ${piId}:`, pushErr);
    }
  }

  return { success: true, transaction_id: transactionId };
}

/**
 * payment_intent.payment_failed
 * - Updates payment_intents status to 'failed'
 */
async function handlePaymentIntentFailed(
  event: any
): Promise<{ success: boolean; error?: string }> {
  const pi = event.data.object;
  const piId: string = pi.id;

  const { error } = await supabase
    .from("payment_intents")
    .update({ status: "failed" })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    console.error(`Failed to update payment_intent to failed for ${piId}:`, error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * payment_intent.canceled
 * - Updates payment_intents status to 'canceled'
 */
async function handlePaymentIntentCanceled(
  event: any
): Promise<{ success: boolean; error?: string }> {
  const pi = event.data.object;
  const piId: string = pi.id;

  const { error } = await supabase
    .from("payment_intents")
    .update({ status: "canceled" })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    console.error(`Failed to update payment_intent to canceled for ${piId}:`, error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * payment_intent.requires_action
 * - Updates payment_intents status to 'requires_action'
 * - Occurs for OXXO vouchers awaiting cash payment
 */
async function handlePaymentIntentRequiresAction(
  event: any
): Promise<{ success: boolean; error?: string }> {
  const pi = event.data.object;
  const piId: string = pi.id;

  const { error } = await supabase
    .from("payment_intents")
    .update({ status: "requires_action" })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    console.error(`Failed to update payment_intent to requires_action for ${piId}:`, error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * charge.refunded
 * - Looks up the PaymentIntent associated with this charge
 * - Logs the refund event for audit purposes
 * - Full reversal (credit note, ledger entry reversal) is Phase 07 scope
 */
async function handleChargeRefunded(
  event: any
): Promise<{ success: boolean; error?: string }> {
  const charge = event.data.object;
  const paymentIntentId: string | undefined = charge.payment_intent;

  if (!paymentIntentId) {
    console.log("charge.refunded: no payment_intent on charge, skipping");
    return { success: true };
  }

  // Look up the local payment_intents record (for logging/audit)
  const { data: paymentIntent, error: lookupError } = await supabase
    .from("payment_intents")
    .select("id, transaction_id, status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (lookupError) {
    console.error(`Failed to look up payment_intent ${paymentIntentId} for refund:`, lookupError);
  }

  if (paymentIntent) {
    console.log(
      `charge.refunded: PaymentIntent ${paymentIntentId} refunded. ` +
        `Local id=${paymentIntent.id}, transaction_id=${paymentIntent.transaction_id}. ` +
        `Full ledger reversal is Phase 07 scope.`
    );
  } else {
    console.log(`charge.refunded: no local record found for ${paymentIntentId}`);
  }

  // Phase 07 will implement: debit the bank account, credit A/R, create credit note
  return { success: true };
}

// ---------------------------------------------------------------------------
// Main request handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stripe-Signature header is required for all requests
  const sigHeader = req.headers.get("stripe-signature");
  if (!sigHeader) {
    return new Response(
      JSON.stringify({ error: "Missing stripe-signature header" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Read raw body for HMAC verification (must use raw bytes, not parsed JSON)
  const payload = await req.text();

  // Verify HMAC-SHA256 signature with timing-safe comparison
  const { verified, event, error: verifyError } = await verifyStripeSignature(
    payload,
    sigHeader,
    STRIPE_WEBHOOK_SECRET
  );

  if (!verified || !event) {
    console.error("Stripe signature verification failed:", verifyError);
    return new Response(JSON.stringify({ error: verifyError }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ---------------------------------------------------------------------------
  // Idempotency check: webhook_events deduplication
  // ---------------------------------------------------------------------------

  // SELECT first to avoid unnecessary write on duplicates
  const { data: existingEvent } = await supabase
    .from("webhook_events")
    .select("id, status")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingEvent) {
    console.log(
      `Duplicate Stripe event ${event.id}, existing status: ${existingEvent.status}`
    );
    // Return 200 so Stripe stops retrying
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // INSERT as "processing" - race condition safe via UNIQUE(event_id) constraint
  const { error: insertError } = await supabase.from("webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    payload: event,
    status: "processing",
  });

  if (insertError) {
    // PostgreSQL error code 23505 = unique_violation
    // Two concurrent requests for the same event - treat as duplicate
    if (insertError.code === "23505") {
      console.log(`Race condition on event ${event.id}, treating as duplicate`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Other insert errors are logged but we continue processing
    console.error("Failed to insert webhook_event:", insertError);
  }

  // ---------------------------------------------------------------------------
  // Route to event-specific handler
  // ---------------------------------------------------------------------------

  let result: { success: boolean; transaction_id?: string; error?: string } = {
    success: true,
  };

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        result = await handlePaymentIntentSucceeded(event);
        break;
      case "payment_intent.payment_failed":
        result = await handlePaymentIntentFailed(event);
        break;
      case "payment_intent.canceled":
        result = await handlePaymentIntentCanceled(event);
        break;
      case "payment_intent.requires_action":
        result = await handlePaymentIntentRequiresAction(event);
        break;
      case "charge.refunded":
        result = await handleChargeRefunded(event);
        break;
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }
  } catch (err: any) {
    console.error(`Unhandled error processing ${event.type}:`, err);
    result = { success: false, error: err?.message ?? String(err) };
  }

  // ---------------------------------------------------------------------------
  // Update webhook_events with final processing result
  // ---------------------------------------------------------------------------

  await supabase
    .from("webhook_events")
    .update({
      status: result.success ? "completed" : "failed",
      error_message: result.error ?? null,
      transaction_id: result.transaction_id ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("event_id", event.id);

  // Always return 200 to Stripe after successful signature verification.
  // Returning non-200 would cause Stripe to retry the webhook endlessly.
  return new Response(JSON.stringify({ received: true, ...result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
