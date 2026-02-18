-- webhook_events: Idempotency deduplication for Stripe webhooks
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  transaction_id UUID REFERENCES transactions(id) ON DELETE RESTRICT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT webhook_events_event_id_unique UNIQUE (event_id)
);

-- Indexes
CREATE INDEX idx_webhook_events_status ON webhook_events(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at DESC);

-- Comments
COMMENT ON TABLE webhook_events IS 'Idempotent webhook event processing. UNIQUE on event_id prevents duplicate processing. No updated_at, no deleted_at - audit trail.';
COMMENT ON COLUMN webhook_events.event_id IS 'Stripe event ID (evt_xxx). Used for idempotency.';

-- NO audit trigger (no updated_at column)

-- RLS
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_webhook_events" ON webhook_events FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "admins_view_webhook_events" ON webhook_events FOR SELECT TO authenticated
  USING (
    (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  );
