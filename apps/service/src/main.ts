import { buildApp } from "./app";
import { startAutoAdvance } from "./kitchen";
import { OrderStore } from "./store";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const autoAdvanceSeconds = Number(
  process.env.KITCHEN_AUTO_ADVANCE_SECONDS ?? 0,
);

const store = new OrderStore();
const app = buildApp({ store, logger: true });

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
