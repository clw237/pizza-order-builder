import { buildApp } from "./app";
import { startAutoAdvance } from "./kitchen";
import { OrderStore } from "./store";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const autoAdvanceSeconds = Number(
  process.env.KITCHEN_AUTO_ADVANCE_SECONDS ?? 0,
);
const kitchenToken = process.env.KITCHEN_TOKEN || undefined;

const store = new OrderStore();
const app = buildApp({ store, logger: true, kitchenToken });

if (!kitchenToken) {
  app.log.warn(
    "KITCHEN_TOKEN is not set: the restaurant routes (list, advance) will refuse every request",
  );
}

if (autoAdvanceSeconds > 0) {
  const stop = startAutoAdvance(store, autoAdvanceSeconds);
  app.addHook("onClose", async () => stop());
  app.log.info(
    `Kitchen auto-advance is on: every ${autoAdvanceSeconds}s per status`,
  );
}

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
