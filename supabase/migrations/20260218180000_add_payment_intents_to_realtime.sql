-- Enable Realtime on payment_intents so mobile can subscribe to status changes
ALTER PUBLICATION supabase_realtime ADD TABLE payment_intents;

-- Index for efficient Realtime filter on stripe_payment_intent_id
CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_id
  ON payment_intents (stripe_payment_intent_id);
