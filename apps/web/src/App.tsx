import { describeOrder, formatCents, validateOrder } from "@pizza/pricing";
import { useEffect, useMemo, useState } from "react";
import { isSettled, type Api, type ApiResult, type OrderView } from "./api";
import { Breakdown, Builder } from "./Builder";
import { emptyDraft, evaluate, fromOrderInput, type Draft } from "./draft";
import { describeNextStep } from "./timing";

const POLL_MS = 3000;
// The service's timer checks once a second, so ask a little after the step is due.
const DUE_GRACE_MS = 1200;
const FINAL: OrderView["status"][] = ["DELIVERED", "CANCELLED"];

interface Pending {
  fingerprint: string;
  key: string;
}

export function App({ api, flaky }: { api: Api; flaky: boolean }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [placed, setPlaced] = useState<OrderView | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [now, setNow] = useState(() => new Date());

  const evaluation = useMemo(() => evaluate(draft), [draft]);
  const showBuilder = placed === null || editing;

  useEffect(() => {
    if (!placed || FINAL.includes(placed.status)) return;
    const timer = setInterval(async () => {
      try {
        const result = await api.get(placed.id);
        if (result.ok) setPlaced(result.order);
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
    const refresh = setTimeout(async () => {
      try {
        const result = await api.get(placedId);
        if (result.ok) setPlaced(result.order);
      } catch {
        // Best effort, like polling: the next poll tries again.
      }
    }, due);
    return () => {
      clearInterval(tick);
      clearTimeout(refresh);
    };
  }, [api, placedId, nextStatusAt]);
  const nextStep = placed ? describeNextStep(placed, now) : null;

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
      setMessage(editing ? "Order updated." : "Order sent!");
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
    const result = await run(() => api.cancel(placed.id));
    if (!result) return;
    if (result.ok) {
      setPlaced(result.order);
      setMessage("Order cancelled.");
    } else {
      setMessage(result.problem.message);
      if (result.problem.order) setPlaced(result.problem.order);
    }
  }

  function edit() {
    if (!placed) return;
    setDraft(fromOrderInput(placed.order));
    setEditing(true);
    setMessage(null);
  }

  function startOver() {
    setPlaced(null);
    setEditing(false);
    setDraft(emptyDraft());
    setMessage(null);
  }

  return (
    <main>
      <header>
        <h1>Pizza Order Builder</h1>
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
            </strong>
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
