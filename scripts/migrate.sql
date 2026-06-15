
-- Find sacms-global ID (replace with actual ID if known, or use subquery)
DO $$
DECLARE
    global_id TEXT;
BEGIN
    SELECT id INTO global_id FROM tenants WHERE slug = 'sacms-global';
    
    IF global_id IS NOT NULL THEN
        RAISE NOTICE 'Found sacms-global ID: %', global_id;
        
        -- Migrate Core Models
        UPDATE content_types SET "tenantId" = NULL WHERE "tenantId" = global_id;
        UPDATE single_types SET "tenantId" = NULL WHERE "tenantId" = global_id;
        UPDATE components SET "tenantId" = NULL WHERE "tenantId" = global_id;
        UPDATE content_entries SET "tenantId" = NULL WHERE "tenantId" = global_id;
        
        -- Migrate Assignments
        UPDATE tenant_content_type_assignments SET "tenantId" = NULL WHERE "tenantId" = global_id;
        UPDATE tenant_single_type_assignments SET "tenantId" = NULL WHERE "tenantId" = global_id;
        UPDATE tenant_component_assignments SET "tenantId" = NULL WHERE "tenantId" = global_id;
        
        RAISE NOTICE 'Migration successful.';
    ELSE
        RAISE NOTICE 'sacms-global tenant not found.';
    END IF;
END $$;
