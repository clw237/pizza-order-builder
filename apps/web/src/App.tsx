import { describeOrder, formatCents, validateOrder } from "@pizza/pricing";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  isSettled,
  latest,
  type Api,
  type ApiResult,
  type OrderView,
} from "./api";
import { Breakdown, Builder } from "./Builder";
import { emptyDraft, evaluate, fromOrderInput, type Draft } from "./draft";
import { describeNextStep } from "./timing";
import { parseOrderId, trackingUrl, withOrderId } from "./tracking";

const POLL_MS = 3000;
// The service's timer checks once a second, so ask a little after the step is due.
const DUE_GRACE_MS = 1200;
const FINAL: OrderView["status"][] = ["DELIVERED", "CANCELLED"];

/** Flavor text only; the real status label always comes first. */
const TURN_PHASE: Record<OrderView["status"], string> = {
  NOT_STARTED: "Untap step",
  STARTED: "Main phase",
  READY_FOR_PICKUP: "Combat: ready to attack",
  DELIVERED: "End step",
  CANCELLED: "Countered",
};

interface Pending {
  fingerprint: string;
  key: string;
}

function showInUrl(id: string | null) {
  const { pathname, search, hash } = window.location;
  const next = withOrderId(search, id);
  if (next !== search) {
    window.history.replaceState(null, "", `${pathname}${next}${hash}`);
  }
}

export function App({
  api,
  flaky,
  initialOrderId,
}: {
  api: Api;
  flaky: boolean;
  initialOrderId: string | null;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [placed, setPlaced] = useState<OrderView | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [trackText, setTrackText] = useState("");

  const evaluation = useMemo(() => evaluate(draft), [draft]);
  const showBuilder = placed === null || editing;

  // Opening a saved tracking link (?order=<id>) shows that order straight away.
  useEffect(() => {
    if (!initialOrderId) return;
    let active = true;
    api
      .get(initialOrderId)
      .then((result) => {
        if (!active) return;
        showTracked(result);
        if (!result.ok) showInUrl(null);
      })
      .catch((error: unknown) => {
        if (active)
          setMessage(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, [api, initialOrderId]);

  useEffect(() => {
    if (!placed || FINAL.includes(placed.status)) return;
    const timer = setInterval(async () => {
      try {
        const result = await api.get(placed.id);
        if (result.ok) setPlaced((current) => latest(current, result.order));
      } catch {
        // Polling is best effort; the next tick tries again.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [api, placed]);

  // Ticks once a second only while the kitchen timer has a next step for this order, and
  // fetches the order just after that step is due instead of waiting for the next poll.
  const placedId = placed?.id ?? null;
  const nextStatusAt = placed?.nextStatusAt ?? null;
  useEffect(() => {
    if (!placedId || !nextStatusAt) return;
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 1000);
    const due =
      Math.max(0, Date.parse(nextStatusAt) - Date.now()) + DUE_GRACE_MS;
    let active = true;
    const refresh = setTimeout(async () => {
      try {
        const result = await api.get(placedId);
        if (active && result.ok) {
          setPlaced((current) => latest(current, result.order));
        }
      } catch {
        // Best effort, like polling: the next poll tries again.
      }
    }, due);
    return () => {
      active = false;
      clearInterval(tick);
      clearTimeout(refresh);
    };
  }, [api, placedId, nextStatusAt]);
  const nextStep = placed ? describeNextStep(placed, now) : null;

  useEffect(() => {
    if (placedId) showInUrl(placedId);
  }, [placedId]);

  function changeDraft(next: Draft) {
    setDraft(next);
    setDescription(null);
  }

  function describe() {
    const result = validateOrder(evaluation.input);
    setDescription(
      result.ok
        ? describeOrder(result.order)
        : "Fix the highlighted fields first.",
    );
  }

  async function run(request: () => Promise<ApiResult>) {
    setBusy(true);
    setMessage(null);
    try {
      return await request();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const { quote, input } = evaluation;
    if (!quote) return;
    // Same order, same key: pressing Submit again after a failure can't create a second order.
    const fingerprint = JSON.stringify([editing ? placed?.id : null, input]);
    const key =
      pending?.fingerprint === fingerprint ? pending.key : crypto.randomUUID();
    setPending({ fingerprint, key });

    const result = await run(() =>
      editing && placed
        ? api.update(placed.id, placed.version, input, quote.total, key)
        : api.submit(input, quote.total, key),
    );
    if (!result) return;
    if (isSettled(result)) setPending(null);
    if (result.ok) {
      setPlaced(result.order);
      setEditing(false);
      setMessage(editing ? "Order updated." : "Cowabunga! Order sent.");
      return;
    }
    setMessage(result.problem.message);
    if (result.problem.order) {
      setPlaced(result.problem.order);
      setEditing(false);
    }
  }

  async function cancel() {
    if (!placed) return;
    const result = await run(() => api.cancel(placed.id, crypto.randomUUID()));
    if (!result) return;
    if (result.ok) {
      setPlaced(result.order);
      setMessage("Order cancelled.");
    } else {
      setMessage(result.problem.message);
      if (result.problem.order) setPlaced(result.problem.order);
    }
  }

  function showTracked(result: ApiResult) {
    if (result.ok) {
      // A slow load mustn't replace an order the customer sent in the meantime.
      setPlaced((current) => current ?? result.order);
      setEditing(false);
      setMessage(null);
      return;
    }
    setMessage(
      result.status === 404 ? "No order with that ID." : result.problem.message,
    );
  }

  async function track(event: FormEvent) {
    event.preventDefault();
    const parsed = parseOrderId(trackText);
    if (!parsed.ok) {
      setMessage(parsed.message);
      return;
    }
    const result = await run(() => api.get(parsed.id));
    if (result) showTracked(result);
  }

  async function copyId() {
    if (!placed) return;
    try {
      await navigator.clipboard.writeText(placed.id);
      setMessage("Order ID copied.");
    } catch {
      setMessage("Couldn't copy. Select the order ID and copy it yourself.");
    }
  }

  function edit() {
    if (!placed) return;
    setDraft(fromOrderInput(placed.order));
    setEditing(true);
    setMessage(null);
  }

  function startOver() {
    showInUrl(null);
    setTrackText("");
    setPlaced(null);
    setEditing(false);
    setDraft(emptyDraft());
    setMessage(null);
  }

  return (
    <main>
      <header>
        <h1>Pizza Order Builder</h1>
        <p className="tagline">Hot slices, delivered straight to the sewer.</p>
        {flaky && (
          <p className="notice">
            Flaky network demo: the first response is dropped and retried.
          </p>
        )}
      </header>

      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}

      {placed && (
        <section className="placed">
          <h2>Your order</h2>
          <p>
            Order <code>{placed.id}</code>:{" "}
            <strong className={`status status-${placed.status}`}>
              {placed.statusLabel}
            </strong>{" "}
            <em className="flavor">· {TURN_PHASE[placed.status]}</em>{" "}
            <button type="button" onClick={copyId}>
              Copy ID
            </button>
          </p>
          <p className="tracking">
            Save this ID to track your order, or keep{" "}
            <a href={trackingUrl(window.location.origin, placed.id)}>
              this link to it
            </a>
            .
          </p>
          {nextStep && <p className="next-step">{nextStep}</p>}
          <pre>{placed.description}</pre>
          <p>Charged total: {formatCents(placed.quote.total)}</p>
          {placed.status === "NOT_STARTED" && !editing && (
            <p>
              <button type="button" onClick={edit} disabled={busy}>
                Change order
              </button>{" "}
              <button type="button" onClick={cancel} disabled={busy}>
                Cancel order
              </button>
            </p>
          )}
          {placed.status !== "NOT_STARTED" && placed.status !== "CANCELLED" && (
            <p className="notice">
              The kitchen has started, so the order can no longer be changed.
            </p>
          )}
          {!editing && (
            <button type="button" onClick={startOver}>
              Start a new order
            </button>
          )}
        </section>
      )}

      {placed === null && (
        <form className="track" onSubmit={track}>
          <h2>Track an order</h2>
          <label>
            Order ID{" "}
            <input
              value={trackText}
              onChange={(event) => setTrackText(event.target.value)}
              placeholder="Paste your order ID or link"
            />
          </label>{" "}
          <button type="submit" disabled={busy}>
            Track
          </button>
        </form>
      )}

      {showBuilder && (
        <div className="layout">
          <Builder
            draft={draft}
            onChange={changeDraft}
            errors={evaluation.errors}
          />
          <aside className="summary">
            <h2>Total</h2>
            <Breakdown quote={evaluation.quote} />
            <button type="button" onClick={describe}>
              Describe my order
            </button>
            {description && <pre className="description">{description}</pre>}
            <button
              type="button"
              className="primary"
              onClick={submit}
              disabled={busy || !evaluation.quote}
            >
              {busy ? "Sending…" : editing ? "Save changes" : "Send order"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                Keep the order as it was
              </button>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
