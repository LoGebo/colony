import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { timingSafeEqual } from "jsr:@std/crypto/timing-safe-equal";

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ---------------------------------------------------------------------------
// Stripe signature verification (timing-safe, replay-attack resistant)
// ---------------------------------------------------------------------------

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
  toleranceSeconds: number = 300, // 5 minutes
): Promise<{ verified: boolean; event?: Record<string, unknown>; error?: string }> {
  // Parse Stripe-Signature header format: t=timestamp,v1=signature
  const parts = sigHeader.split(",");
  const timestampStr = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatureHex = parts.find((p) => p.startsWith("v1="))?.slice(3);

  if (!timestampStr || !signatureHex) {
    return { verified: false, error: "Invalid signature header format" };
  }

  const timestamp = parseInt(timestampStr, 10);
  const now = Math.floor(Date.now() / 1000);

  // Reject events outside tolerance window (prevent replay attacks)
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return { verified: false, error: "Timestamp outside tolerance" };
  }

  // Compute expected HMAC-SHA256(timestamp + "." + payload)
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const expectedBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload)),
  );

  // Decode received hex signature to raw bytes for proper constant-time comparison
  const receivedBytes = new Uint8Array(signatureHex.length / 2);
  for (let i = 0; i < signatureHex.length; i += 2) {
    receivedBytes[i / 2] = parseInt(signatureHex.substring(i, i + 2), 16);
  }

  // Both HMAC-SHA256 outputs are always 32 bytes. Reject mismatched lengths
  // without timing leak (Stripe signatures are always 64 hex chars = 32 bytes).
  if (expectedBytes.length !== receivedBytes.length) {
    return { verified: false, error: "Signature verification failed" };
  }

  // Timing-safe comparison on raw HMAC bytes (not hex strings)
  const isValid = timingSafeEqual(expectedBytes, receivedBytes);
  if (!isValid) {
    return { verified: false, error: "Signature verification failed" };
  }

  try {
    const event = JSON.parse(payload);
    return { verified: true, event };
  } catch {
    return { verified: false, error: "Invalid payload" };
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

interface HandlerResult {
  success: boolean;
  transaction_id?: string;
  error?: string;
}

/**
 * payment_intent.succeeded
 * - Updates payment_intents status to 'succeeded'
 * - Calls record_payment() RPC to create double-entry ledger entries
 * - Stores the returned transaction_id in payment_intents
 * - Sends push notification to the resident (non-critical, try/catch wrapped)
 * - Uses OXXO-specific description when payment_method_type is 'oxxo'
 */
async function handlePaymentIntentSucceeded(
  event: Record<string, unknown>,
): Promise<HandlerResult> {
  const pi = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;
  const piId = pi.id as string;
  const amount = pi.amount as number; // centavos
  const metadata = (pi.metadata ?? {}) as Record<string, string>;

  const communityId = metadata.community_id;
  const unitId = metadata.unit_id;
  const residentId = metadata.resident_id;

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

  if (!residentId) {
    console.warn(
      `payment_intent.succeeded: missing resident_id in metadata for ${piId}. Audit trail will be incomplete.`,
    );
  }

  // 1. Update payment_intents status -> succeeded
  const { error: updateError } = await supabase
    .from("payment_intents")
    .update({ status: "succeeded" })
    .eq("stripe_payment_intent_id", piId);

  if (updateError) {
    console.error(
      `Failed to update payment_intent status for ${piId}:`,
      updateError,
    );
    return {
      success: false,
      error: `Failed to update status: ${updateError.message}`,
    };
  }

  // 2. Look up local payment_intent to determine payment method type
  //    Used to differentiate OXXO vs card in ledger description
  const { data: localPi } = await supabase
    .from("payment_intents")
    .select("payment_method_type")
    .eq("stripe_payment_intent_id", piId)
    .single();

  const paymentDescription = localPi?.payment_method_type === "oxxo"
    ? `Pago OXXO via Stripe - ${piId}`
    : localPi?.payment_method_type === "spei"
      ? `Pago SPEI via Stripe - ${piId}`
      : `Pago con tarjeta via Stripe - ${piId}`;

  // 3. Call record_payment() RPC
  //    Amount from Stripe is in centavos -> divide by 100 for MXN pesos
  const { data: transactionId, error: rpcError } = await supabase.rpc(
    "record_payment",
    {
      p_community_id: communityId,
      p_unit_id: unitId,
      p_amount: amount / 100,
      p_payment_date: new Date(((pi.created as number) ?? Math.floor(Date.now() / 1000)) * 1000).toISOString().split("T")[0],
      p_description: paymentDescription,
      p_payment_method_id: null, // Stripe is not a row in payment_methods table
      p_created_by: residentId ?? null, // Audit trail
    },
  );

  if (rpcError) {
    console.error(`record_payment() failed for ${piId}:`, rpcError);
    return {
      success: false,
      error: `record_payment failed: ${rpcError.message}`,
    };
  }

  if (!transactionId) {
    console.error(`record_payment() returned null for ${piId}`);
    return {
      success: false,
      error: "record_payment returned null transaction_id",
    };
  }

  // 4. Store transaction_id in payment_intents
  const { error: txUpdateError } = await supabase
    .from("payment_intents")
    .update({ transaction_id: transactionId })
    .eq("stripe_payment_intent_id", piId);

  if (txUpdateError) {
    console.error(
      `Failed to store transaction_id on payment_intent ${piId}:`,
      txUpdateError,
    );
  }

  // 5. Auto-generate receipt (non-critical — payment already recorded)
  try {
    // Generate sequential receipt number
    const { data: receiptNumber, error: receiptNumError } = await supabase.rpc(
      "generate_receipt_number",
      { p_community_id: communityId },
    );

    if (receiptNumError) {
      console.warn(
        `generate_receipt_number failed for ${piId}:`,
        receiptNumError,
      );
    } else {
      const paymentMethodLabel = localPi?.payment_method_type === "oxxo"
        ? "oxxo"
        : localPi?.payment_method_type === "spei"
          ? "transfer"
          : "card";

      const { error: receiptError } = await supabase
        .from("receipts")
        .insert({
          community_id: communityId,
          unit_id: unitId,
          resident_id: residentId ?? null,
          transaction_id: transactionId,
          stripe_payment_intent_id: piId,
          receipt_number: receiptNumber,
          amount: amount / 100,
          currency: "MXN",
          payment_method: paymentMethodLabel,
          description: paymentDescription,
          payment_date: new Date().toISOString().split("T")[0],
        });

      if (receiptError) {
        // UNIQUE violation on transaction_id means receipt already exists (idempotent)
        if (receiptError.code === "23505") {
          console.log(`Receipt already exists for transaction ${transactionId}`);
        } else {
          console.warn(
            `Failed to create receipt for ${piId}:`,
            receiptError,
          );
        }
      } else {
        console.log(
          `Receipt ${receiptNumber} created for transaction ${transactionId}`,
        );
      }
    }
  } catch (receiptErr) {
    console.warn(`Receipt generation error for ${piId}:`, receiptErr);
  }

  // 6. Send push notification (non-critical)
  if (residentId) {
    try {
      const { data: resident, error: residentError } = await supabase
        .from("residents")
        .select("user_id")
        .eq("id", residentId)
        .maybeSingle();

      if (residentError) {
        console.warn(
          `Could not look up resident ${residentId} for push:`,
          residentError,
        );
      } else if (resident?.user_id) {
        const amountFormatted = (amount / 100).toFixed(2);
        const { error: pushError } = await supabase.functions.invoke(
          "send-push",
          {
            body: {
              user_id: resident.user_id,
              title: "Pago recibido",
              body: `Tu pago de $${amountFormatted} ha sido procesado`,
            },
          },
        );
        if (pushError) {
          console.warn(
            `Push notification failed for resident ${residentId}:`,
            pushError,
          );
        }
      }
    } catch (pushErr) {
      console.warn(`Push notification error for ${piId}:`, pushErr);
    }
  }

  return { success: true, transaction_id: transactionId };
}

/**
 * payment_intent.payment_failed
 * - Updates status to 'failed'
 * - Sends OXXO expiry push notification when payment_method_type is 'oxxo'
 *   (non-critical, try/catch wrapped)
 */
async function handlePaymentIntentFailed(
  event: Record<string, unknown>,
): Promise<HandlerResult> {
  const pi = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;
  const piId = pi.id as string;

  const { error } = await supabase
    .from("payment_intents")
    .update({ status: "failed" })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    console.error(
      `Failed to update payment_intent to failed for ${piId}:`,
      error,
    );
    return { success: false, error: error.message };
  }

  // Send OXXO expiry push notification (non-critical)
  const { data: piRecord } = await supabase
    .from("payment_intents")
    .select("payment_method_type, resident_id")
    .eq("stripe_payment_intent_id", piId)
    .maybeSingle();

  if (piRecord?.payment_method_type === "oxxo" && piRecord?.resident_id) {
    try {
      const { data: resident } = await supabase
        .from("residents")
        .select("user_id")
        .eq("id", piRecord.resident_id)
        .maybeSingle();

      if (resident?.user_id) {
        await supabase.functions.invoke("send-push", {
          body: {
            user_id: resident.user_id,
            title: "Voucher OXXO expirado",
            body: "Tu voucher OXXO ha expirado. Genera uno nuevo para pagar.",
          },
        });
      }
    } catch (pushErr) {
      console.warn(`OXXO expiry push notification error for ${piId}:`, pushErr);
    }
  }

  return { success: true };
}

/**
 * payment_intent.canceled
 */
async function handlePaymentIntentCanceled(
  event: Record<string, unknown>,
): Promise<HandlerResult> {
  const pi = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;
  const piId = pi.id as string;

  const { error } = await supabase
    .from("payment_intents")
    .update({ status: "canceled" })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    console.error(
      `Failed to update payment_intent to canceled for ${piId}:`,
      error,
    );
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * payment_intent.requires_action
 * Occurs for OXXO vouchers awaiting cash payment.
 * Stores hosted_voucher_url in payment_intents.metadata via JSONB merge
 * (preserves existing metadata fields from create-payment-intent).
 */
async function handlePaymentIntentRequiresAction(
  event: Record<string, unknown>,
): Promise<HandlerResult> {
  const pi = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;
  const piId = pi.id as string;

  // Extract hosted_voucher_url from Stripe event payload (snake_case server-side)
  const nextAction = pi.next_action as Record<string, unknown> | undefined;
  const oxxoDetails = nextAction?.oxxo_display_details as Record<string, unknown> | undefined;
  const hostedVoucherUrl = oxxoDetails?.hosted_voucher_url as string | undefined;

  // Fetch existing metadata and MERGE — do NOT overwrite.
  // metadata already contains stripe_created and payment_method_types from create-payment-intent.
  const { data: existingRecord } = await supabase
    .from("payment_intents")
    .select("metadata")
    .eq("stripe_payment_intent_id", piId)
    .single();

  const mergedMetadata = {
    ...((existingRecord?.metadata as Record<string, unknown>) ?? {}),
    ...(hostedVoucherUrl ? { hosted_voucher_url: hostedVoucherUrl } : {}),
  };

  const { error } = await supabase
    .from("payment_intents")
    .update({ status: "requires_action", metadata: mergedMetadata })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    console.error(
      `Failed to update payment_intent to requires_action for ${piId}:`,
      error,
    );
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * payment_intent.processing
 * Occurs when an OXXO payment has been confirmed at the store but Stripe
 * is still waiting for bank settlement confirmation.
 */
async function handlePaymentIntentProcessing(
  event: Record<string, unknown>,
): Promise<HandlerResult> {
  const pi = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;
  const piId = pi.id as string;

  const { error } = await supabase
    .from("payment_intents")
    .update({ status: "processing" })
    .eq("stripe_payment_intent_id", piId);

  if (error) {
    console.error(`Failed to update payment_intent to processing for ${piId}:`, error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * charge.refunded
 * Full reversal (credit note, ledger entry reversal) is Phase 07 scope
 */
async function handleChargeRefunded(
  event: Record<string, unknown>,
): Promise<HandlerResult> {
  const charge = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;
  const paymentIntentId = charge.payment_intent as string | undefined;

  if (!paymentIntentId) {
    console.warn(
      "charge.refunded: no payment_intent on charge — unexpected event shape",
    );
    return { success: true };
  }

  const { data: paymentIntent, error: lookupError } = await supabase
    .from("payment_intents")
    .select("id, transaction_id, status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (lookupError) {
    console.error(
      `Failed to look up payment_intent ${paymentIntentId} for refund:`,
      lookupError,
    );
  }

  if (paymentIntent) {
    console.log(
      `charge.refunded: PaymentIntent ${paymentIntentId} refunded. ` +
        `Local id=${paymentIntent.id}, transaction_id=${paymentIntent.transaction_id}. ` +
        `Full ledger reversal is Phase 07 scope.`,
    );
  } else {
    console.warn(
      `charge.refunded: no local record found for ${paymentIntentId}`,
    );
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Main request handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sigHeader = req.headers.get("stripe-signature");
  if (!sigHeader) {
    return new Response(
      JSON.stringify({ error: "Missing stripe-signature header" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const payload = await req.text();

  const { verified, event, error: verifyError } = await verifyStripeSignature(
    payload,
    sigHeader,
    STRIPE_WEBHOOK_SECRET,
  );

  if (!verified || !event) {
    // Log details internally but return generic message to caller
    console.error("Stripe signature verification failed:", verifyError);
    return new Response(
      JSON.stringify({ error: "Webhook verification failed" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // ---------------------------------------------------------------------------
  // Idempotency: INSERT-first pattern (atomic, no SELECT race window)
  // ---------------------------------------------------------------------------

  const eventId = event.id as string;
  const eventType = event.type as string;

  const { error: insertError } = await supabase.from("webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
    payload: event,
    status: "processing",
  });

  if (insertError) {
    // PostgreSQL error code 23505 = unique_violation = duplicate event
    if (insertError.code === "23505") {
      console.log(`Duplicate Stripe event ${eventId}`);
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    // Non-duplicate insert failure — likely DB connectivity issue
    console.error("Failed to insert webhook_event:", insertError);
    // Return 500 so Stripe retries when DB recovers
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  // ---------------------------------------------------------------------------
  // Route to event-specific handler
  // ---------------------------------------------------------------------------

  let result: HandlerResult = { success: true };

  try {
    switch (eventType) {
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
      case "payment_intent.processing":
        result = await handlePaymentIntentProcessing(event);
        break;
      case "charge.refunded":
        result = await handleChargeRefunded(event);
        break;
      default:
        console.log(`Unhandled Stripe event type: ${eventType}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Unhandled error processing ${eventType}:`, err);
    result = { success: false, error: message };
  }

  // ---------------------------------------------------------------------------
  // Update webhook_events with final processing result
  // ---------------------------------------------------------------------------

  const { error: updateError } = await supabase
    .from("webhook_events")
    .update({
      status: result.success ? "completed" : "failed",
      error_message: result.error ?? null,
      transaction_id: result.transaction_id ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);

  if (updateError) {
    console.error(
      `Failed to update webhook_event status for ${eventId}:`,
      updateError,
    );
  }

  // Always return 200 to Stripe after valid signature verification.
  // Non-200 would cause Stripe to retry, potentially causing duplicate processing.
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
