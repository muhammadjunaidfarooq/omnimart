import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  idPrefix: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  defaultLabel?: string;
}

export function DateRangeFilter({ idPrefix, from, to, onFromChange, onToChange, defaultLabel }: Props) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-from`}>From</Label>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          className="w-40"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-to`}>To</Label>
        <Input
          id={`${idPrefix}-to`}
          type="date"
          className="w-40"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
        />
      </div>
      {!from && !to && defaultLabel && <p className="pb-1.5 text-sm text-muted-foreground">{defaultLabel}</p>}
    </>
  );
}
