import { Card, CardContent, CardHeader, CardTitle } from "../../../shared/ui/primitives";

interface EvalEmptyPanelProps {
  description: string;
  title: string;
}

export function EvalEmptyPanel({ description, title }: EvalEmptyPanelProps) {
  return (
    <Card className="border-white/8 bg-white/[0.03]">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
