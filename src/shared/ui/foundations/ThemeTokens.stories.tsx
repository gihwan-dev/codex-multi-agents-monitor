import type { Meta } from "@storybook/react-vite";

const meta = {
  title: "Foundations/Theme Tokens",
  render: () => <ThemeTokensPreview />,
} satisfies Meta;

export default meta;

export const Default = {};

function ThemeTokensPreview() {
  const swatches = [
    ["Background", "var(--color-bg)"],
    ["Panel", "var(--color-panel)"],
    ["Surface", "var(--color-surface)"],
    ["Active", "var(--color-active)"],
    ["Success", "var(--color-success)"],
    ["Waiting", "var(--color-waiting)"],
    ["Failed", "var(--color-failed)"],
    ["Handoff", "var(--color-handoff)"],
  ] as const;

  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-2">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Theme-ready token contract
        </p>
        <h2 className="text-2xl font-semibold">Dark and light previews share one semantic map.</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          These swatches come from the semantic token layer that now feeds Tailwind utilities and
          shadcn primitives together.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {swatches.map(([label, color]) => (
          <div
            key={label}
            className="grid gap-3 rounded-[var(--radius-panel)] border border-white/8 bg-[var(--color-panel)] p-4"
          >
            <div
              className="h-16 rounded-[var(--radius-soft)] border border-white/8"
              style={{ backgroundColor: color }}
            />
            <div className="grid gap-1">
              <span className="text-sm font-semibold">{label}</span>
              <code className="text-xs text-muted-foreground">{color}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
