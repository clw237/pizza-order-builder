import { describe, expect, it } from "vitest";
import {
  orderIdFromUrl,
  parseOrderId,
  trackingUrl,
  withOrderId,
} from "../src/tracking";

const id = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
const otherId = "00000000-0000-4000-8000-000000000000";

describe("S-19 a customer tracks an order by its ID", () => {
  describe("parseOrderId", () => {
    it("accepts a bare ID", () => {
      expect(parseOrderId(id)).toEqual({ ok: true, id });
    });

    it("trims spaces and newlines around a pasted ID", () => {
      expect(parseOrderId(`  ${id}\n`)).toEqual({ ok: true, id });
    });

    it("lower-cases an upper-case ID", () => {
      expect(parseOrderId(id.toUpperCase())).toEqual({ ok: true, id });
    });

    it("accepts a pasted tracking link", () => {
      expect(parseOrderId(`http://localhost:5173/?order=${id}`)).toEqual({
        ok: true,
        id,
      });
    });

    it("accepts a pasted link with a #fragment", () => {
      expect(parseOrderId(`http://localhost:5173/?order=${id}#top`)).toEqual({
        ok: true,
        id,
      });
    });

    it.each(["", "   ", "abc", `${id}x`, "http://localhost:5173/?order=nope"])(
      "rejects %j without calling the service",
      (text) => {
        expect(parseOrderId(text)).toEqual({
          ok: false,
          message: "That doesn't look like an order ID.",
        });
      },
    );
  });

  describe("orderIdFromUrl", () => {
    it("reads ?order= from the page URL", () => {
      expect(orderIdFromUrl(`?order=${id}`)).toBe(id);
    });

    it("ignores other parameters", () => {
      expect(orderIdFromUrl(`?flaky&order=${id}`)).toBe(id);
    });

    it("returns null without the parameter", () => {
      expect(orderIdFromUrl("?flaky")).toBeNull();
    });

    it("returns null for a malformed ID", () => {
      expect(orderIdFromUrl("?order=nope")).toBeNull();
    });
  });

  describe("trackingUrl", () => {
    it("builds a link that orderIdFromUrl reads back", () => {
      const url = trackingUrl("http://localhost:5173", id);
      expect(url).toBe(`http://localhost:5173/?order=${id}`);
      expect(orderIdFromUrl(new URL(url).search)).toBe(id);
    });
  });

  describe("withOrderId", () => {
    it("puts the shown order in the URL so a reload keeps it", () => {
      expect(withOrderId("", id)).toBe(`?order=${id}`);
    });

    it("replaces a stale order ID", () => {
      expect(withOrderId(`?order=${otherId}`, id)).toBe(`?order=${id}`);
    });

    it("drops ?order= when no order is shown", () => {
      expect(withOrderId(`?order=${id}`, null)).toBe("");
    });

    it("keeps the other parameters", () => {
      expect(withOrderId(`?flaky&order=${id}`, null)).toBe("?flaky=");
    });
  });
});
