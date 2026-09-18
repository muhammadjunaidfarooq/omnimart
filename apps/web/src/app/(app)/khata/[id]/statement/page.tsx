import { notFound, redirect } from "next/navigation";
import { getBorrowerStatement, getCurrentUser, getSettings } from "@/lib/api";
import { InvoiceActions } from "@/components/sales/invoice-actions";
import { StatementCard } from "@/components/khata/statement-card";

export default async function KhataStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const { from, to } = await searchParams;
  const [statement, settings] = await Promise.all([
    getBorrowerStatement(id, { from, to }),
    getSettings(),
  ]);

  if (!statement) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 print:max-w-none">
      <InvoiceActions backHref={`/khata/${id}`} backLabel="Back to khata" />
      <StatementCard statement={statement} settings={settings} from={from} to={to} />
    </div>
  );
}
