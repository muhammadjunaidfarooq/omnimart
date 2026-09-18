"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { centsToInput, formatMoney, inputToCents } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { useSortedRows } from "@/lib/use-sort";
import {
  createService,
  deleteService,
  fetchServices,
  servicesKeys,
  updateService,
  updateServiceStatus,
  SERVICE_DIRECTION_LABELS,
  type Service,
  type ServiceDirection,
} from "@/lib/services";

const SERVICE_DIRECTIONS = Object.keys(SERVICE_DIRECTION_LABELS) as ServiceDirection[];

const SORT_ACCESSORS: Record<string, (s: Service) => string | number | null> = {
  name: (s) => s.name,
  direction: (s) => s.direction,
  defaultFee: (s) => (s.useTieredFee ? s.feePerThousand : s.defaultFee),
  isActive: (s) => (s.isActive ? 1 : 0),
};

export function ServicesManager() {
  const { data: services, isLoading } = useQuery({
    queryKey: servicesKeys.list(),
    queryFn: fetchServices,
  });
  const queryClient = useQueryClient();
  const currencySymbol = useCurrencySymbol();

  const { sortedRows: sortedServices, sortBy, sortOrder, handleSortChange } = useSortedRows(
    services,
    SORT_ACCESSORS,
    "name",
  );

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateServiceStatus(id, isActive),
    onSuccess: (_, { isActive }) => {
      toast.success(isActive ? "Service activated." : "Service deactivated.");
      queryClient.invalidateQueries({ queryKey: servicesKeys.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: () => {
      toast.success("Service deleted.");
      queryClient.invalidateQueries({ queryKey: servicesKeys.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: DataTableColumn<Service>[] = [
    {
      header: "Name",
      sortKey: "name",
      cell: (s) => <span className="font-medium">{s.name}</span>,
    },
    {
      header: "Direction",
      sortKey: "direction",
      cell: (s) => <Badge variant="outline">{SERVICE_DIRECTION_LABELS[s.direction]}</Badge>,
    },
    {
      header: "Fee",
      sortKey: "defaultFee",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (s) =>
        s.useTieredFee
          ? `${formatMoney(s.feePerThousand ?? 0, currencySymbol)} / 1,000`
          : s.defaultFee != null
            ? formatMoney(s.defaultFee, currencySymbol)
            : "—",
    },
    {
      header: "Status",
      sortKey: "isActive",
      cell: (s) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={s.isActive}
            disabled={statusMutation.isPending}
            onCheckedChange={(checked) => statusMutation.mutate({ id: s.id, isActive: checked })}
          />
          <Badge variant={s.isActive ? "secondary" : "outline"}>
            {s.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      ),
    },
    {
      header: "Actions",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <ServiceFormDialog service={s} />
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${s.name}`}>
                  <Trash2 className="size-4" />
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {s.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This can&apos;t be undone. Services with transaction history can&apos;t be
                  deleted — deactivate them instead.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(s.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <ServiceFormDialog />
      </div>
      <DataTable
        columns={columns}
        rows={sortedServices}
        isLoading={isLoading}
        emptyMessage="No services yet."
        keyExtractor={(s) => s.id}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />
    </div>
  );
}

function ServiceFormDialog({ service }: { service?: Service }) {
  const isEdit = Boolean(service);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(service?.name ?? "");
  const [direction, setDirection] = useState<ServiceDirection>(service?.direction ?? "BILL_PAYMENT");
  const [defaultFee, setDefaultFee] = useState(
    service?.defaultFee != null ? centsToInput(service.defaultFee) : "",
  );
  const [useTieredFee, setUseTieredFee] = useState(service?.useTieredFee ?? false);
  const [feePerThousand, setFeePerThousand] = useState(
    service?.feePerThousand != null ? centsToInput(service.feePerThousand) : "",
  );
  const [isActive, setIsActive] = useState(service?.isActive ?? true);

  const isBillPayment = direction === "BILL_PAYMENT";

  function handleOpenChange(next: boolean) {
    if (next) {
      setName(service?.name ?? "");
      setDirection(service?.direction ?? "BILL_PAYMENT");
      setDefaultFee(service?.defaultFee != null ? centsToInput(service.defaultFee) : "");
      setUseTieredFee(service?.useTieredFee ?? false);
      setFeePerThousand(service?.feePerThousand != null ? centsToInput(service.feePerThousand) : "");
      setIsActive(service?.isActive ?? true);
    }
    setOpen(next);
  }

  const mutation = useMutation({
    mutationFn: () => {
      const input = {
        name,
        direction,
        useTieredFee,
        ...(useTieredFee
          ? { feePerThousand: inputToCents(feePerThousand) }
          : { defaultFee: defaultFee ? inputToCents(defaultFee) : undefined }),
        isActive,
      };
      return isEdit ? updateService(service!.id, input) : createService(input);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Service updated." : "Service added.");
      queryClient.invalidateQueries({ queryKey: servicesKeys.all });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Enter a service name.");
      return;
    }
    if (useTieredFee && !feePerThousand) {
      toast.error("Enter a fee per Rs 1,000.");
      return;
    }
    mutation.mutate();
  }

  const formId = `service-form-${service?.id ?? "new"}`;

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        isEdit ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${service?.name}`}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            New service
          </Button>
        )
      }
      title={isEdit ? "Edit service" : "New service"}
      description={
        isEdit
          ? "Update this service's details."
          : "Add a new service the cashier can offer at checkout."
      }
      footer={
        <Button form={formId} type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="service-name">Name</Label>
          <Input
            id="service-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Electricity Bill"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="service-direction">Type</Label>
          <Select value={direction} onValueChange={(v) => v && setDirection(v as ServiceDirection)}>
            <SelectTrigger id="service-direction" className="w-full">
              <SelectValue>{(v: string) => SERVICE_DIRECTION_LABELS[v as ServiceDirection]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SERVICE_DIRECTIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {SERVICE_DIRECTION_LABELS[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {isBillPayment
              ? "The customer pays the shop — e.g. an electricity bill or Easyload top-up."
              : direction === "CASH_WITHDRAWAL"
                ? "The shop hands the customer cash, funded by a transfer they already made. Any fee is deducted from the cash paid out."
                : "The customer hands the shop cash, and the shop transfers it out on their behalf. Any fee is added to the cash collected."}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <Label htmlFor="service-tiered">Charge per Rs 1,000 (tiered)</Label>
            <p className="text-sm text-muted-foreground">
              e.g. a rate of 20 charges 20 for a Rs 1,000 {isBillPayment ? "bill" : "transaction"} and
              100 for a Rs 5,000 one — amounts round up to the next Rs 1,000.
            </p>
          </div>
          <Switch id="service-tiered" checked={useTieredFee} onCheckedChange={setUseTieredFee} />
        </div>
        {useTieredFee ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="service-fee-per-thousand">Fee per Rs 1,000</Label>
            <Input
              id="service-fee-per-thousand"
              type="number"
              step="0.01"
              min="0"
              value={feePerThousand}
              onChange={(e) => setFeePerThousand(e.target.value)}
              placeholder="0.00"
              required
            />
            <p className="text-sm text-muted-foreground">
              The fee is calculated automatically from the amount at checkout.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="service-fee">Default fee (optional)</Label>
            <Input
              id="service-fee"
              type="number"
              step="0.01"
              min="0"
              value={defaultFee}
              onChange={(e) => setDefaultFee(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-sm text-muted-foreground">
              Prefills the cashier&apos;s service fee — they can still adjust it per transaction.
            </p>
          </div>
        )}
        {isEdit && (
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="service-active">Active</Label>
              <p className="text-sm text-muted-foreground">
                Inactive services are hidden from the cashier&apos;s picker.
              </p>
            </div>
            <Switch id="service-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        )}
      </form>
    </Modal>
  );
}
