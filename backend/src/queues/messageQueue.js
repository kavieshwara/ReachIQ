import { processCampaignMessages } from "../services/campaignService.js";
import { isDemoMode } from "../utils/demo.js";

const connectionUrl = process.env.UPSTASH_REDIS_URL;
const connectionToken = process.env.UPSTASH_REDIS_TOKEN;
const queueEnabled = process.env.ENABLE_QUEUES === "true";
let QueueClass = null;
let WorkerClass = null;
let IORedisClass = null;

if (!isDemoMode && queueEnabled && connectionUrl) {
  const [{ Queue, Worker }, redisModule] = await Promise.all([
    import("bullmq"),
    import("ioredis")
  ]);
  QueueClass = Queue;
  WorkerClass = Worker;
  IORedisClass = redisModule.default;
}

const redisOptions = connectionUrl
  ? {
      maxRetriesPerRequest: null,
      tls: connectionUrl.startsWith("rediss://") ? {} : undefined,
      password: connectionToken || undefined
    }
  : null;

export const queueConnection = !isDemoMode && queueEnabled && connectionUrl
  ? new IORedisClass(connectionUrl, {
      ...redisOptions,
      lazyConnect: true,
      connectTimeout: 5000,
      retryStrategy: () => null
    })
  : null;

if (!queueEnabled) {
  console.log("[ReachIQ] Redis queues disabled. Set ENABLE_QUEUES=true to enable BullMQ workers.");
} else if (queueConnection) {
  queueConnection.on("error", (error) => {
    console.error(`[${new Date().toISOString()}] Redis connection warning`, error.message);
  });
}

export const messageQueue = queueConnection
  ? new QueueClass("messages", { connection: queueConnection })
  : null;

export const messageWorker = queueConnection
  ? new WorkerClass(
      "messages",
      async (job) => {
        await processCampaignMessages(job.data);
      },
      { connection: queueConnection, concurrency: 1 }
    )
  : null;
