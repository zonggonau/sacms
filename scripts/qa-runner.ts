/**
 * SaCMS — QA Audit Runner Entrypoint
 * Forwards to scripts/qa/qa-runner.ts
 */
import { runQAAudit } from "./qa/qa-runner";

const baseUrl = process.argv[2];
runQAAudit(baseUrl).then((res) => {
  process.exit(res.passedCount === res.total ? 0 : 1);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
