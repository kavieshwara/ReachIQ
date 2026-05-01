import { queueConnection } from "./messageQueue.js";
import { runDueFollowUps } from "../services/followUpService.js";

let QueueClass = null;
let WorkerClass = null;

if (queueConnection) {
  const bullmq = await import("bullmq");
  QueueClass = bullmq.Queue;
  WorkerClass = bullmq.Worker;
}

export const followUpQueue = queueConnection
  ? new QueueClass("followups", { connection: queueConnection })
  : null;

export const followUpWorker = queueConnection
  ? new WorkerClass(
      "followups",
      async () => {
        await runDueFollowUps();
      },
      { connection: queueConnection, concurrency: 1 }
    )
  : null;
