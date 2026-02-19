-- Fix generate_receipt_number() race condition (QA BUG-B)
-- Problem: concurrent webhook calls could read the same MAX and produce duplicate receipt numbers
-- Solution: pg_advisory_xact_lock serializes access per community+year

-- Also add UNIQUE constraint on (community_id, receipt_number) as a safety net

CREATE OR REPLACE FUNCTION public.generate_receipt_number(
  p_community_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_lock_key BIGINT;
BEGIN
  v_year := TO_CHAR(p_date, 'YYYY');

  -- Advisory lock keyed on community_id hash + year to serialize receipt generation
  v_lock_key := hashtext(p_community_id::TEXT || v_year);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(
    MAX(
      NULLIF(
        REGEXP_REPLACE(receipt_number, '^REC-' || v_year || '-', ''),
        receipt_number
      )::INTEGER
    ),
    0
  ) + 1
  INTO v_sequence
  FROM public.receipts
  WHERE community_id = p_community_id
    AND receipt_number LIKE 'REC-' || v_year || '-%';

  RETURN 'REC-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
END;
$$;

-- Add UNIQUE constraint on receipt_number per community (safety net for race conditions)
ALTER TABLE public.receipts
  ADD CONSTRAINT uq_receipt_community_number UNIQUE (community_id, receipt_number);
