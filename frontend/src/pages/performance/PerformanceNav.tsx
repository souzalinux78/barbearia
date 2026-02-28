import { NavLink } from "react-router-dom";

const performanceNav = [
  { to: "/performance", label: "Dashboard" },
  { to: "/performance/ranking", label: "Ranking" },
  { to: "/performance/goals", label: "Metas" },
  { to: "/performance/badges", label: "Badges" },
  { to: "/performance/challenges", label: "Desafios" }
];

export const PerformanceNav = () => (
  <div className="overflow-x-auto">
    <div className="flex min-w-max gap-2">
      {performanceNav.map((item) => (
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

