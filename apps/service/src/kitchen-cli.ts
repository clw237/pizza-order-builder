/**
 * The restaurant side, from a terminal. Talks to the running service over HTTP.
 *   npm run kitchen -- list
 *   npm run kitchen -- advance <order id>
 */
const serviceUrl = process.env.SERVICE_URL ?? "http://127.0.0.1:3000";

interface OrderSummary {
  id: string;
  statusLabel: string;
  description: string;
  quote: { total: number };
}

async function main(args: string[]): Promise<number> {
  const [command, id] = args;
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
  if (command === "advance" && id) {
    const order = (await request(
      "POST",
      `/orders/${encodeURIComponent(id)}/advance`,
    )) as OrderSummary;
    console.log(`${order.id} is now ${order.statusLabel}`);
    return 0;
  }
  console.error("Usage: npm run kitchen -- list | advance <order id>");
  return 2;
}

async function request(method: string, path: string): Promise<unknown> {
  const response = await fetch(`${serviceUrl}${path}`, { method });
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
