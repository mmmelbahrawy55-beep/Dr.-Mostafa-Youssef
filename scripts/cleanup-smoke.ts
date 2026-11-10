/**
 * Removes records created by scripts/smoke.mjs (emails starting with smoke1. /
 * smoke2. and their payments, subscriptions, files and messages).
 *
 *   REDIS_PREFIX=dm npx tsx scripts/cleanup-smoke.ts
 *
 * Only touches test accounts created today, so real customers are never at risk.
 */
import { allRows, deleteFile, deleteRow, releaseOnce, type PaymentRow, type SubscriptionRow, type UserRow } from "../server/db";

const PREFIX = (process.env.REDIS_PREFIX || "dm").replace(/:+$/, "");
console.log(`Cleaning smoke-test data in namespace "${PREFIX}:".`);

const today = new Date().toISOString().slice(0, 10);
const [users, payments, subscriptions, messages] = await Promise.all([
  allRows<UserRow & { created_at: string }>("users"),
  allRows<PaymentRow>("payments"),
  allRows<SubscriptionRow>("subscriptions"),
  allRows<{ id: number; email: string; created_at: string }>("messages"),
]);

const testUsers = users.filter(
  (user) => /^smoke[12]\./i.test(user.email) && String(user.created_at).slice(0, 10) === today
);
const ids = new Set(testUsers.map((user) => Number(user.id)));

let deletedPayments = 0;
for (const payment of payments) {
  if (!ids.has(Number(payment.user_id))) continue;
  if (payment.screenshot) await deleteFile(payment.screenshot).catch(() => undefined);
  if (payment.screenshot_sha) await releaseOnce(`shot:${payment.screenshot_sha}`).catch(() => undefined);
  if (payment.reference_key) await releaseOnce(`ref:${payment.reference_key}`).catch(() => undefined);
  await deleteRow("payments", payment.id);
  deletedPayments += 1;
}

let deletedSubscriptions = 0;
for (const subscription of subscriptions) {
  if (!ids.has(Number(subscription.user_id))) continue;
  await deleteRow("subscriptions", subscription.id);
  deletedSubscriptions += 1;
}

let deletedMessages = 0;
for (const message of messages) {
  if (!testUsers.some((user) => user.email === message.email)) continue;
  await deleteRow("messages", message.id);
  deletedMessages += 1;
}

for (const user of testUsers) await deleteRow("users", user.id);

console.log(
  `Removed ${testUsers.length} users, ${deletedPayments} payments, ${deletedSubscriptions} subscriptions, ${deletedMessages} messages.`
);
