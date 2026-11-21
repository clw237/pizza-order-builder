import { buildApp } from "./app";
import { isManual, readSchedule, startAutoAdvance } from "./kitchen";
import { OrderStore } from "./store";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const scheduleResult = readSchedule(process.env);
if (!scheduleResult.ok) {
  console.error(scheduleResult.message);
  process.exit(1);
}
const schedule = scheduleResult.schedule;
const kitchenToken = process.env.KITCHEN_TOKEN || undefined;
// Comma-separated browser origins allowed to send POST and PUT; unset means the dev builder.
const listedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const allowedOrigins = listedOrigins.length > 0 ? listedOrigins : undefined;

const store = new OrderStore();
const app = buildApp({
  store,
  logger: true,
  kitchenToken,
  schedule,
  allowedOrigins,
});

if (!kitchenToken) {
  app.log.warn(
    "KITCHEN_TOKEN is not set: the restaurant routes (list, advance) will refuse every request",
  );
}

if (isManual(schedule)) {
  app.log.info("Kitchen timer is off: orders move only with the kitchen CLI");
} else {
  const stop = startAutoAdvance(store, schedule);
  app.addHook("onClose", async () => stop());
  app.log.info(
    `Kitchen timer: start after ${schedule.NOT_STARTED}s, ready after ${schedule.STARTED}s, delivered after ${schedule.READY_FOR_PICKUP}s (0 = by hand)`,
  );
}

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
