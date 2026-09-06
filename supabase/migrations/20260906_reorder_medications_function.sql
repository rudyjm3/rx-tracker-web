-- Migration: Add reorder_medications database function
-- This function atomically updates sort_order for multiple medications in a single transaction

CREATE OR REPLACE FUNCTION reorder_medications(medication_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  med_id UUID;
  idx INTEGER := 0;
BEGIN
  -- Update each medication's sort_order in sequence
  -- All updates happen in a single transaction, so either all succeed or all roll back
  FOREACH med_id IN ARRAY medication_ids
  LOOP
    UPDATE medications
    SET sort_order = idx
    WHERE id = med_id;
    
    idx := idx + 1;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reorder_medications(UUID[]) TO authenticated;
