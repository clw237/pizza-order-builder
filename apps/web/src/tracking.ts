// Order ids are random UUIDs from the service; checking the shape here means a typo gets a clear
// message without a round trip, and nothing but a UUID is ever put into the request path.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type ParsedOrderId =
  { ok: true; id: string } | { ok: false; message: string };

function asOrderId(text: string | null): string | null {
  const id = text?.trim().toLowerCase() ?? "";
  return UUID.test(id) ? id : null;
}

/** The id the page was opened with (`?order=<id>`), or null. */
export function orderIdFromUrl(search: string): string | null {
  return asOrderId(new URLSearchParams(search).get("order"));
}

/** Reads what the customer pasted into "Track an order": a bare id or a tracking link. */
export function parseOrderId(text: string): ParsedOrderId {
  const trimmed = text.trim();
  // The base only lets a link pasted without its origin parse; just the query is read.
  const id = trimmed.includes("?")
    ? orderIdFromUrl(new URL(trimmed, "http://localhost").search)
    : asOrderId(trimmed);
  return id
    ? { ok: true, id }
    : { ok: false, message: "That doesn't look like an order ID." };
}

/** The link that reopens an order, for the customer to save. */
export function trackingUrl(origin: string, id: string): string {
  return `${origin}/?order=${encodeURIComponent(id)}`;
}

/**
 * The page's query string naming the order on screen, or without `?order=` when none is, so a
 * reload shows the same thing and a stale link can't bring back an older order.
 */
export function withOrderId(search: string, id: string | null): string {
  const params = new URLSearchParams(search);
  if (id) params.set("order", id);
  else params.delete("order");
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}
