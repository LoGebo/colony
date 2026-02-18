-- stripe_customers: Maps residents to Stripe Customer IDs
CREATE TABLE stripe_customers (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  stripe_customer_id TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT stripe_customers_stripe_id_unique UNIQUE (stripe_customer_id),
  CONSTRAINT stripe_customers_resident_unit_unique UNIQUE (resident_id, unit_id)
);

-- Indexes
CREATE INDEX idx_stripe_customers_community ON stripe_customers(community_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stripe_customers_resident ON stripe_customers(resident_id) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE stripe_customers IS 'Maps residents to Stripe Customer IDs. One per resident+unit combination.';
COMMENT ON COLUMN stripe_customers.stripe_customer_id IS 'Stripe Customer ID (cus_xxx). Unique globally.';

-- Audit trigger
CREATE TRIGGER stripe_customers_audit
  BEFORE INSERT OR UPDATE ON stripe_customers
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- RLS
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_stripe_customers" ON stripe_customers FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "residents_view_own_stripe_customers" ON stripe_customers FOR SELECT TO authenticated
  USING (
    resident_id IN (
      SELECT r.id FROM residents r
      WHERE r.user_id = auth.uid()
      AND r.deleted_at IS NULL
    )
  );

CREATE POLICY "admins_view_community_stripe_customers" ON stripe_customers FOR SELECT TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'community_admin', 'manager')
  );
