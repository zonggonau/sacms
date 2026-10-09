import { provisionTenant } from "../src/lib/tenant-provisioning";

async function main() {
  const tenantId = "cmnykawbq003huj2cui6wf50r";
  console.log(`Manually re-provisioning tenant ${tenantId}...`);
  const success = await provisionTenant(tenantId, undefined, "sacms-starter");
  console.log(`Provisioning ${success ? 'succeeded' : 'failed'}`);
  process.exit(success ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
