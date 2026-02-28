import { NavLink } from "react-router-dom";

const links = [
  { to: "/automation/rules", label: "Regras" },
  { to: "/automation/whatsapp", label: "WhatsApp/Webhook" },
  { to: "/automation/messages", label: "Mensagens" },
  { to: "/automation/metrics", label: "Metricas" }
];

export const AutomationNav = () => (
  <nav className="overflow-x-auto pb-1">
    <div className="flex min-w-max gap-2">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            `rounded-xl px-3 py-2 text-xs font-semibold transition ${
              isActive
                ? "bg-gold text-charcoal"
                : "border border-white/15 bg-charcoal/60 text-slate-200"
            }`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </div>
  </nav>
);
