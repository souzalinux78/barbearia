import { NavLink } from "react-router-dom";
import { sidebarNavItems } from "./nav-items";
import logo from "../../assets/logo.svg";
import { useAuthStore } from "../../store/auth.store";

export const Sidebar = () => {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-charcoal/90 px-4 py-6 md:flex md:flex-col">
      <img src={logo} alt="Barbearia Premium" className="mb-8 h-9 w-auto" />

      <nav className="space-y-1">
        {sidebarNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block rounded-xl px-3 py-2 text-sm transition ${
                isActive ? "bg-gold text-charcoal font-semibold" : "text-slate-300 hover:bg-white/10"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3 rounded-xl bg-graphite/80 p-3">
        <p className="text-sm font-semibold text-slate-100">{user?.name}</p>
        <p className="text-xs uppercase tracking-wide text-slate-400">{user?.role}</p>
        <button
          className="w-full rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-slate-100"
          onClick={clearSession}
        >
          Sair
        </button>
      </div>
    </aside>
  );
};
