-- payment_intents: Tracks Stripe PaymentIntents for audit and status sync
CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  resident_id UUID REFERENCES residents(id) ON DELETE RESTRICT,
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'MXN',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN (
    'created', 'requires_payment_method', 'requires_confirmation',
    'requires_action', 'processing', 'succeeded', 'failed', 'canceled'
  )),
  payment_method_type TEXT,
  description TEXT,
  idempotency_key TEXT NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT payment_intents_stripe_pi_unique UNIQUE (stripe_payment_intent_id),
  CONSTRAINT payment_intents_idempotency_unique UNIQUE (idempotency_key),
  CONSTRAINT payment_intents_positive_amount CHECK (amount > 0)
);

-- Indexes
CREATE INDEX idx_payment_intents_community_status ON payment_intents(community_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_intents_unit ON payment_intents(unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_intents_status ON payment_intents(status) WHERE status NOT IN ('succeeded', 'failed', 'canceled');
CREATE INDEX idx_payment_intents_expires ON payment_intents(expires_at) WHERE expires_at IS NOT NULL AND status NOT IN ('succeeded', 'failed', 'canceled');

-- Comments
COMMENT ON TABLE payment_intents IS 'Tracks Stripe PaymentIntents. Links to transactions table after successful payment via record_payment(). Supports card and OXXO payment methods.';
COMMENT ON COLUMN payment_intents.stripe_payment_intent_id IS 'Stripe PaymentIntent ID (pi_xxx). Unique globally.';
COMMENT ON COLUMN payment_intents.idempotency_key IS 'Client-generated key for preventing double charges.';
COMMENT ON COLUMN payment_intents.transaction_id IS 'FK to transactions table - set after record_payment() succeeds.';
COMMENT ON COLUMN payment_intents.status IS 'Mirrors Stripe PI status: created, requires_payment_method, requires_confirmation, requires_action, processing, succeeded, failed, canceled';
COMMENT ON COLUMN payment_intents.expires_at IS 'For OXXO: when the voucher expires (48h from creation). NULL for card payments.';

-- Audit trigger
CREATE TRIGGER payment_intents_audit
  BEFORE INSERT OR UPDATE ON payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- RLS
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_payment_intents" ON payment_intents FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Residents can view their own unit's payment intents via occupancies join
-- NOTE: occupancies.resident_id is a business ID (residents.id), not auth.uid()
-- Must join through residents.user_id to get auth.uid()
CREATE POLICY "residents_view_own_payment_intents" ON payment_intents FOR SELECT TO authenticated
  USING (
    unit_id IN (
      SELECT o.unit_id FROM occupancies o
      JOIN residents r ON r.id = o.resident_id
      WHERE r.user_id = auth.uid()
      AND o.deleted_at IS NULL
      AND r.deleted_at IS NULL
    )
  );

-- Admins can view all payment intents in their community
CREATE POLICY "admins_view_community_payment_intents" ON payment_intents FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  );
