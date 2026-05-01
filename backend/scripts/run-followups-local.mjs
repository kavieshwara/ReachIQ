import "../src/utils/loadEnv.js";

import { runDueFollowUps } from "../src/services/followUpService.js";

async function main() {
  console.log("[ReachIQ] Running local follow-up simulation...");
  const summary = await runDueFollowUps({ source: "local-script" });
  console.log("[ReachIQ] Local follow-up summary:");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[ReachIQ] Local follow-up simulation failed", error);
  process.exit(1);
});
