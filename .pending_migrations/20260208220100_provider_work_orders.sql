-- Migration: provider_work_orders table
-- Phase 14: Guard Advanced + Admin Providers/Parking/Moves
-- Purpose: Work order tracking for service providers

CREATE TABLE provider_work_orders (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,

  -- Reference number (auto-generated)
  work_order_number TEXT NOT NULL,

  -- Details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT, -- plumbing, electrical, etc.

  -- Location
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  location_description TEXT,

  -- Scheduling
  requested_date DATE,
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  completed_date DATE,

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled'
  )),

  -- Cost tracking
  estimated_cost NUMERIC(15, 4),
  actual_cost NUMERIC(15, 4),
  currency TEXT NOT NULL DEFAULT 'MXN',

  -- Link to maintenance ticket (if work order was created from a ticket)
  ticket_id UUID REFERENCES maintenance_tickets(id) ON DELETE SET NULL,

  -- Rating (after completion)
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  rating_notes TEXT,

  -- Assigned personnel
  assigned_personnel_ids UUID[], -- Array of provider_personnel IDs

  -- Notes
  admin_notes TEXT,
  provider_notes TEXT,

  -- Completion
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completion_notes TEXT,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Unique work order number per community
  CONSTRAINT uq_work_order_number UNIQUE (community_id, work_order_number)
);

-- Auto-generate work order number
CREATE OR REPLACE FUNCTION generate_work_order_number(p_community_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_year TEXT;
  v_seq INTEGER;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(work_order_number, '^WO-' || v_year || '-', ''), work_order_number)::INTEGER), 0) + 1
  INTO v_seq
  FROM public.provider_work_orders
  WHERE community_id = p_community_id AND work_order_number LIKE 'WO-' || v_year || '-%';
  RETURN 'WO-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END; $$;

CREATE OR REPLACE FUNCTION set_work_order_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.work_order_number IS NULL OR NEW.work_order_number = '' THEN
    NEW.work_order_number := public.generate_work_order_number(NEW.community_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trigger_set_work_order_number
  BEFORE INSERT ON provider_work_orders
  FOR EACH ROW EXECUTE FUNCTION set_work_order_number();

-- Update provider stats on completion
CREATE OR REPLACE FUNCTION update_provider_work_order_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.providers SET
      total_work_orders = total_work_orders + 1,
      average_rating = (
        SELECT AVG(rating) FROM public.provider_work_orders
        WHERE provider_id = NEW.provider_id AND rating IS NOT NULL AND deleted_at IS NULL
      )
    WHERE id = NEW.provider_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trigger_update_provider_stats
  AFTER UPDATE ON provider_work_orders
  FOR EACH ROW EXECUTE FUNCTION update_provider_work_order_stats();

-- Indexes
CREATE INDEX idx_work_orders_community_status ON provider_work_orders(community_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_provider ON provider_work_orders(provider_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_scheduled ON provider_work_orders(scheduled_date) WHERE status IN ('approved', 'scheduled') AND deleted_at IS NULL;

-- RLS
ALTER TABLE provider_work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manager_work_orders" ON provider_work_orders
  FOR ALL TO authenticated
  USING (community_id = (SELECT get_current_community_id()) AND (SELECT get_current_user_role()) IN ('admin', 'manager'))
  WITH CHECK (community_id = (SELECT get_current_community_id()) AND (SELECT get_current_user_role()) IN ('admin', 'manager'));

CREATE POLICY "guard_view_work_orders" ON provider_work_orders
  FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()) AND (SELECT get_current_user_role()) = 'guard' AND deleted_at IS NULL);

-- Audit
CREATE TRIGGER set_work_orders_audit BEFORE INSERT OR UPDATE ON provider_work_orders FOR EACH ROW EXECUTE FUNCTION set_audit_fields();
CREATE TRIGGER work_orders_soft_delete BEFORE DELETE ON provider_work_orders FOR EACH ROW EXECUTE FUNCTION soft_delete();
