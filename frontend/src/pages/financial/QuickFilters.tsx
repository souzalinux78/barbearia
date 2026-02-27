import { QuickFilter } from "../../services/financial.service";

const quickFilters: Array<{ value: QuickFilter; label: string }> = [
  { value: "TODAY", label: "Hoje" },
  { value: "7D", label: "7 dias" },
  { value: "30D", label: "30 dias" }
];

export const QuickFilters = ({
  value,
  onChange
}: {
  value: QuickFilter;
  onChange: (value: QuickFilter) => void;
}) => (
  <div className="flex gap-2">
    {quickFilters.map((item) => (
      <button
        key={item.value}
        onClick={() => onChange(item.value)}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
          value === item.value ? "bg-gold text-charcoal" : "border border-white/20 text-slate-300"
        }`}
      >
        {item.label}
      </button>
    ))}
  </div>
);
