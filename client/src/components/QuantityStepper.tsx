import { Button } from "@/components/ui/button";

interface Props {
  value: number;
  max: number;
  onChange: (value: number) => void;
  min?: number;
  label?: string;
}

export function QuantityStepper({ value, max, onChange, min = 1, label = "Quantity" }: Props) {
  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <Button
        variant="outline"
        size="sm"
        className="w-9 px-0"
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </Button>
      <span className="w-8 text-center tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="w-9 px-0"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </Button>
    </div>
  );
}