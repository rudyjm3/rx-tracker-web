import { AlertTriangle } from "lucide-react";
import type { Medication } from "@/lib/types/medications";

export function LowSupplyBanner({ medications }: { medications: Medication[] }) {
  const lowSupply = medications.filter(
    (m) =>
      m.inventory_enabled &&
      m.current_quantity != null &&
      m.current_quantity <= m.low_supply_threshold,
  );

  if (lowSupply.length === 0) return null;

  return (
    <div className="flex items-start gap-2 rounded-card border border-status-warning/40 bg-status-warning/10 p-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-status-warning" />
      <div className="text-sm text-brand-text">
        <span className="font-medium">Low supply: </span>
        {lowSupply.map((m, i) => (
          <span key={m.id}>
            {m.name} ({m.current_quantity} {m.inventory_unit} left)
            {i < lowSupply.length - 1 ? ", " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
