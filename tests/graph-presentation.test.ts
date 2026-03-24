import { describe, expect, it } from "vitest";
import { buildGraphCardStyle } from "../src/widgets/causal-graph/lib/graphPresentation.js";

describe("graphPresentation", () => {
  it("adds the active accent for user prompt cards", () => {
    const style = buildGraphCardStyle("user.prompt", false, false);

    expect(style.borderLeftWidth).toBe(3);
    expect(style.borderLeftColor).toBe("var(--color-active)");
    expect(style.background).toBe("var(--gradient-graph-card-user)");
  });

  it("uses the turn chrome for turn boundary events", () => {
    const style = buildGraphCardStyle("turn.finished", false, false);

    expect(style.borderStyle).toBe("dashed");
    expect(style.background).toBe("transparent");
    expect(style.boxShadow).toBe("none");
    expect(style.opacity).toBe(0.6);
  });

  it("keeps the selected border emphasis when a card is selected", () => {
    const style = buildGraphCardStyle("llm.finished", true, false);

    expect(style.borderTopColor).toBe("var(--color-graph-card-border-selected)");
    expect(style.boxShadow).toBe("var(--shadow-graph-card-selected)");
  });
});
