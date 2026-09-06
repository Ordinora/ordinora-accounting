CREATE OR REPLACE FUNCTION "block_dormant_tenant_journal_changes"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_tenant_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_tenant_id := OLD."tenantId";
  ELSE
    target_tenant_id := NEW."tenantId";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Tenant"
    WHERE "id" = target_tenant_id
      AND "status" = 'DORMANT'
  ) THEN
    RAISE EXCEPTION 'Dormant companies are read-only. Reactivate the company before changing journals.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Journal_block_dormant_tenant_changes" ON "Journal";

CREATE TRIGGER "Journal_block_dormant_tenant_changes"
BEFORE INSERT OR UPDATE OR DELETE ON "Journal"
FOR EACH ROW
EXECUTE FUNCTION "block_dormant_tenant_journal_changes"();
