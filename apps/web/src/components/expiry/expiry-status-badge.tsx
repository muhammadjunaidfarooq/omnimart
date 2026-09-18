import { Badge } from "@/components/ui/badge";
import type { ExpiryStatus } from "@/lib/catalog";

export function ExpiryStatusBadge({ status }: { status: ExpiryStatus }) {
  if (status === "EXPIRED") return <Badge variant="destructive">Expired</Badge>;
  if (status === "EXPIRING_SOON")
    return (
      <Badge
        variant="secondary"
        className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      >
        Expiring Soon
      </Badge>
    );
  if (status === "GOOD")
    return (
      <Badge
        variant="secondary"
        className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      >
        Good
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-muted-foreground">
      No Expiry
    </Badge>
  );
}
