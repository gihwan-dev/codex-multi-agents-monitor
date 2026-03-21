import type { Meta } from "@storybook/react-vite";
import { Button } from "./button";

const meta = {
  title: "Primitives/Button",
  render: () => <ButtonShowcase />,
} satisfies Meta<typeof Button>;

export default meta;

export const Default = {};

function ButtonShowcase() {
  return (
    <div className="grid gap-6 p-6">
      <div className="flex flex-wrap gap-3">
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="xs">XS</Button>
        <Button size="sm">Small</Button>
        <Button>Default</Button>
        <Button size="lg">Large</Button>
        <Button disabled>Disabled</Button>
      </div>
    </div>
  );
}
