-- ============================================
-- PHASE 06: NOTIFY RESIDENTS OF NEW CHARGES
-- ============================================
-- After generating monthly charges, create in-app notifications
-- for all residents of charged units.

CREATE OR REPLACE FUNCTION notify_charge_run(
  p_charge_run_id UUID,
  p_description TEXT DEFAULT 'Nuevo cargo generado'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_community_id UUID;
  v_total_amount NUMERIC(15, 2);
  v_notified INTEGER := 0;
  v_resident RECORD;
BEGIN
  -- Get charge run details
  SELECT cr.community_id, cr.total_amount
  INTO v_community_id, v_total_amount
  FROM public.charge_runs cr
  WHERE cr.id = p_charge_run_id
    AND cr.deleted_at IS NULL;

  IF v_community_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Insert notification for each active resident of each charged unit
  FOR v_resident IN
    SELECT DISTINCT r.user_id
    FROM public.charge_run_items cri
    JOIN public.occupancies o ON o.unit_id = cri.unit_id
      AND o.status = 'active'
      AND o.deleted_at IS NULL
    JOIN public.residents r ON r.id = o.resident_id
      AND r.user_id IS NOT NULL
      AND r.deleted_at IS NULL
    WHERE cri.charge_run_id = p_charge_run_id
      AND cri.status = 'charged'
  LOOP
    INSERT INTO public.notifications (
      community_id,
      user_id,
      notification_type,
      title,
      body,
      action_type,
      action_data,
      source_type,
      source_id,
      channels_requested
    ) VALUES (
      v_community_id,
      v_resident.user_id,
      'payment_due',
      'Nuevo cargo generado',
      p_description,
      'open_payment',
      jsonb_build_object('charge_run_id', p_charge_run_id),
      'payment',
      p_charge_run_id,
      ARRAY['in_app', 'push']::public.notification_channel[]
    );
    v_notified := v_notified + 1;
  END LOOP;

  RETURN v_notified;
END;
$$;

COMMENT ON FUNCTION notify_charge_run IS
  'Creates in-app + push notifications for all residents of units in a charge run.';
