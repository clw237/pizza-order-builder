/**
 * The restaurant side, from a terminal. Talks to the running service over HTTP and sends the
 * KITCHEN_TOKEN it was started with.
 *   KITCHEN_TOKEN=<token> npm run kitchen -- list
 *   KITCHEN_TOKEN=<token> npm run kitchen -- advance <order id>
 */
const serviceUrl = process.env.SERVICE_URL ?? "http://127.0.0.1:3000";
const kitchenToken = process.env.KITCHEN_TOKEN;

interface OrderSummary {
  id: string;
  statusLabel: string;
  description: string;
  quote: { total: number };
}

async function main(args: string[]): Promise<number> {
  const [command, id] = args;
  const known = command === "list" || (command === "advance" && id);
  if (!known) {
    console.error("Usage: npm run kitchen -- list | advance <order id>");
    return 2;
  }
  if (!kitchenToken) {
    console.error(
      "Set KITCHEN_TOKEN to the same value the service was started with.",
    );
    return 2;
  }
  if (command === "list") {
    const orders = (await request("GET", "/orders")) as OrderSummary[];
    if (orders.length === 0) console.log("No orders yet.");
    for (const o of orders) {
      console.log(
        `${o.id}  ${o.statusLabel.padEnd(16)}  $${(o.quote.total / 100).toFixed(2)}  ${o.description.replaceAll("\n", "; ")}`,
      );
    }
    return 0;
  }
  const order = (await request(
    "POST",
    `/orders/${encodeURIComponent(id ?? "")}/advance`,
  )) as OrderSummary;
  console.log(`${order.id} is now ${order.statusLabel}`);
  return 0;
}

async function request(method: string, path: string): Promise<unknown> {
  const response = await fetch(`${serviceUrl}${path}`, {
    method,
    headers: { "kitchen-token": kitchenToken ?? "" },
  });
  const body = (await response.json()) as { message?: string };
  if (!response.ok) throw new Error(body.message ?? `HTTP ${response.status}`);
  return body;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
