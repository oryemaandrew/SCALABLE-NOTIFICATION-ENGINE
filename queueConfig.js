import "dotenv/config";
import { Queue } from "bullmq";
import IORedis from "ioredis";

export const redisConnection = new IORedis(
  process.env.REDIS_URL || "redis://127.0.0.1:6379",
  {
  maxRetriesPerRequest: null, // ⚠️ Crucial: BullMQ requires this to be null to handle connection drops safely
  }
);

// 2. Initialize the Producer Queue (Our "Sorting Bin" manager)
// We name the queue "NotificationQueue" just like your architecture diagram layout
export const notificationQueue = new Queue("NotificationQueue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000
    },
    removeOnComplete: {
      age: 60 * 60,
      count: 1000
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
      count: 5000
    }
  }
});

// Log out a success anchor to your terminal when Express boots up
redisConnection.on("connect", () => {
  console.log("🟢 Connected: Express is successfully wired up to the Redis server!");
});

redisConnection.on("error", (err) => {
  console.error("🔴 Redis Connection Error:", err);
});
