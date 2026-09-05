import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapInsightCards } from "./insights";

describe("mapInsightCards", () => {
  it("assigns ids and drops invalid hrefs", () => {
    const cards = mapInsightCards({
      insights: [
        {
          severity: "alert",
          title: "Leave clash",
          body: "Engineering has overlapping leave.",
          action: "Review leave",
          href: "/admin/people/leave",
          metricKey: "leave",
        },
        {
          severity: "info",
          title: "Bad link",
          body: "Ignore this destination.",
          action: "Go elsewhere",
          href: "https://evil.example",
        },
      ],
    });
    assert.equal(cards.length, 2);
    assert.equal(cards[0]?.href, "/admin/people/leave");
    assert.equal(cards[1]?.href, undefined);
    assert.equal(Boolean(cards[0]?.id), true);
    assert.equal(cards[0]?.metricKey, "leave");
  });

  it("ignores unknown severity and empty titles", () => {
    const cards = mapInsightCards({
      insights: [
        { severity: "critical", title: "Nope", body: "x", action: "y" },
        { severity: "watch", title: "", body: "Missing title", action: "Act" },
        { severity: "info", title: "Keep", body: "Body", action: "Act" },
      ],
    });
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.title, "Keep");
  });
});
