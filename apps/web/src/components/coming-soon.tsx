import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <Card className="max-w-md border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Coming in {phase}</CardTitle>
          <CardDescription>This section hasn&apos;t been built yet.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
