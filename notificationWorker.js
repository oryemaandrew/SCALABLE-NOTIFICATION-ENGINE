import "dotenv/config";
import { Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { Vonage } from '@vonage/server-sdk'; 
import { redisConnection } from './queueConfig.js';

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,      
  apiSecret: process.env.VONAGE_API_SECRET 
});

const sendWelcomeEmail = async ({ name, email }) => {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  const port = Number(process.env.SMTP_PORT || 587);

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASS are required to send email");
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid port number");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || SMTP_USER,
    to: email,
    subject: `Welcome to our Platform, ${name}!`,
    text: `Hi ${name},\n\nThank you for signing up! Your account has been successfully created and secured.`,
    html: `<b>Hi ${name},</b><p>Thank you for signing up! Your account has been successfully created and secured.</p>`
  });
};

const notificationWorker = new Worker('NotificationQueue', async (job) => {
    console.log(`\n──────────────────────────────────────────────────`);
    console.log(`📥 [Worker] Processing Job ID: ${job.id} | Name: ${job.name}`);
    const { name, email, phone, type } = job.data;

    if (!["EMAIL", "SMS", "EMAIL_AND_SMS"].includes(type)) {
      throw new Error(`Unsupported notification type: ${type}`);
    }

    if (type === "EMAIL" || type === "EMAIL_AND_SMS") {
      if (!email) {
        throw new Error(`Email job ${job.id} has no recipient email address`);
      }

      await sendWelcomeEmail({ name, email });
      console.log(`Welcome email sent to ${email}`);
    }

    // 📲 LIVE ROUTE B: ACTIVE AND OPEN FOR TESTING
    if (type === "EMAIL_AND_SMS" || type === "SMS") {
        if (!phone) {
          throw new Error(`SMS job ${job.id} has no recipient phone number`);
        }

        if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
          throw new Error(`SMS job ${job.id} has an invalid recipient phone number format`);
        }

        if (!process.env.VONAGE_API_KEY || !process.env.VONAGE_API_SECRET) {
          throw new Error("Vonage API credentials are not configured");
        }

        console.log(`📱 [SMS Gateway] Sending SMS to the registered phone number...`);

        const response = await vonage.sms.send({
          to: phone,
          from: process.env.VONAGE_SENDER_ID || "VonageAPIs",
          text: `Hello ${name}! Your account registration is verified and complete. Welcome aboard!`
        });

        const message = response.messages[0];
        if (!message || String(message.status) !== "0") {
          throw new Error(`Vonage rejected the SMS with status ${message?.status ?? "missing response"}`);
        }

        console.log(`✅ [SMS Engine] Vonage accepted the SMS. Message ID: ${message.messageId ?? message["message-id"]}`);
    }
   
    console.log(`🏁 [Worker] Completed Job ID: ${job.id}`);
    console.log(`──────────────────────────────────────────────────\n`);
  },
  {
    connection: redisConnection,
    concurrency: 1, 
  }
);

notificationWorker.on("completed", (job) => {
  console.log(`🎉 Success: Job ${job.id} cleared out.`);
});

notificationWorker.on("failed", (job, err) => {
  console.error(`🚨 Failure: Job ${job?.id} failed with operational error: ${err.message}`);
});

console.log("👷 Production BullMQ Notification Worker initialized and listening...");
