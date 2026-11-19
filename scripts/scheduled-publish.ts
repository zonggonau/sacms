/**
 * SaCMS — Scheduled Content Publishing Entrypoint
 * Forwards to scripts/core/scheduled-publish.ts
 */
import { processScheduledContent } from "./core/scheduled-publish";

const isDryRun = process.argv.includes("--dry-run");
processScheduledContent({ dryRun: isDryRun })
  .then(({ totalErrors }) => process.exit(totalErrors > 0 ? 1 : 0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
