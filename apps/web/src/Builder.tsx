import {
  MENU,
  applyRate,
  formatCents,
  type FieldError,
  type Quote,
} from "@pizza/pricing";
import {
  addLine,
  removeLine,
  toggleTopping,
  updateLine,
  type Draft,
} from "./draft";

interface BuilderProps {
  draft: Draft;
  onChange: (draft: Draft) => void;
  errors: FieldError[];
}

export function Builder({ draft, onChange, errors }: BuilderProps) {
  const errorFor = (path: string) =>
    errors
      .filter((e) => e.path === path || e.path.startsWith(`${path}.`))
      .map((e) => e.message);

  return (
    <section className="builder">
      <h2>Build your order</h2>
      {errorFor("lines").length > 0 && draft.lines.length === 0 && (
        <p className="error">Add at least one pizza</p>
      )}
      {draft.lines.map((line, index) => {
        const size = MENU.sizes.find((s) => s.id === line.sizeId);
        return (
          <fieldset key={line.key} className="line">
            <legend>Pizza {index + 1}</legend>
            <label>
              Size{" "}
              <select
                value={line.sizeId}
                onChange={(e) =>
                  onChange(
                    updateLine(draft, line.key, { sizeId: e.target.value }),
                  )
                }
              >
                {MENU.sizes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({formatCents(s.price)})
                  </option>
                ))}
              </select>
            </label>{" "}
            <label>
              Quantity{" "}
              <input
                type="number"
                min={1}
                max={99}
                value={Number.isNaN(line.quantity) ? "" : line.quantity}
                onChange={(e) =>
                  onChange(
                    updateLine(draft, line.key, {
                      quantity: e.target.valueAsNumber,
                    }),
                  )
                }
              />
            </label>{" "}
            <button
              type="button"
              onClick={() => onChange(removeLine(draft, line.key))}
            >
              Remove pizza
            </button>
            {MENU.categories.map((category) => (
              <div
                key={category.id}
                className={`toppings toppings-${category.id}`}
              >
                <h3>{category.label} toppings</h3>
                {MENU.toppings
                  .filter((t) => t.categoryId === category.id)
                  .map((topping) => {
                    const selected = line.toppingIds.includes(topping.id);
                    return (
                      <label
                        key={topping.id}
                        className={selected ? "topping selected" : "topping"}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            onChange(toggleTopping(draft, line.key, topping.id))
                          }
                        />
                        {topping.label}
                        {size && (
                          <span className="cost">
                            +{formatCents(applyRate(size.price, category.rate))}
                          </span>
                        )}
                      </label>
                    );
                  })}
              </div>
            ))}
            {errorFor(`lines.${index}`).map((message) => (
              <p key={message} className="error">
                {message}
              </p>
            ))}
          </fieldset>
        );
      })}
      <button type="button" onClick={() => onChange(addLine(draft))}>
        Add another pizza
      </button>
      <h3>Promo codes</h3>
      <input
        aria-label="Promo codes"
        placeholder="e.g. ILOVEPIZZA"
        value={draft.promoText}
        onChange={(e) => onChange({ ...draft, promoText: e.target.value })}
      />
      {errorFor("promoCodes").map((message) => (
        <p key={message} className="error">
          {message}
        </p>
      ))}
      <h3>Tip</h3>
      <label>
        <input
          type="radio"
          name="tipMode"
          checked={draft.tipMode === "dollars"}
          onChange={() => onChange({ ...draft, tipMode: "dollars" })}
        />
        Dollars
      </label>{" "}
      <label>
        <input
          type="radio"
          name="tipMode"
          checked={draft.tipMode === "percent"}
          onChange={() => onChange({ ...draft, tipMode: "percent" })}
        />
        Percent of bill
      </label>{" "}
      <input
        aria-label="Tip"
        inputMode="decimal"
        placeholder={draft.tipMode === "dollars" ? "3.50" : "15"}
        value={draft.tipValue}
        onChange={(e) => onChange({ ...draft, tipValue: e.target.value })}
      />
      {errorFor("tip").map((message) => (
        <p key={message} className="error">
          {message}
        </p>
      ))}
    </section>
  );
}

export function Breakdown({ quote }: { quote: Quote | undefined }) {
  if (!quote)
    return (
      <p className="total pending">
        Fix the highlighted fields to see your total.
      </p>
    );
  return (
    <table className="breakdown">
      <tbody>
        <Row label="Subtotal" amount={quote.subtotal} />
        {quote.discount > 0 && (
          <Row
            label={`Discount (${quote.appliedPromos.join(", ")})`}
            amount={-quote.discount}
          />
        )}
        <Row label="Tax (6.5%)" amount={quote.tax} />
        <Row label="Tip" amount={quote.tip} />
        <tr className="total">
          <th>Total</th>
          <td>{formatCents(quote.total)}</td>
        </tr>
        {quote.promoNotices.map((notice) => (
          <tr
            key={notice.code}
            className={notice.status === "unknown" ? "error" : "notice"}
          >
            <td colSpan={2}>{notice.message}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Row({ label, amount }: { label: string; amount: number }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{amount < 0 ? `−${formatCents(-amount)}` : formatCents(amount)}</td>
    </tr>
  );
}
