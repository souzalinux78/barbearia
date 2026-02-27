import { NavLink } from "react-router-dom";

const financialNav = [
  { to: "/finance", label: "Resumo" },
  { to: "/finance/cashflow", label: "Caixa" },
  { to: "/finance/expenses", label: "Despesas" },
  { to: "/finance/commissions", label: "Comissoes" },
  { to: "/finance/dre", label: "DRE" }
];

export const FinancialNav = () => (
  <div className="overflow-x-auto">
    <div className="flex min-w-max gap-2">
      {financialNav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
              isActive ? "bg-gold text-charcoal" : "border border-white/15 text-slate-300"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  </div>
);
