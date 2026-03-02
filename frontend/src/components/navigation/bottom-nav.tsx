import { NavLink } from "react-router-dom";
import { getBottomNavItems } from "./nav-items";
import { useAuthStore } from "../../store/auth.store";

export const BottomNav = () => {
  const role = useAuthStore((state) => state.user?.role);
  const navItems = getBottomNavItems(role);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-charcoal/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 md:hidden">
      <ul
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `block rounded-lg px-2 py-2 text-center text-[11px] font-medium ${
                  isActive ? "bg-gold text-charcoal" : "text-slate-300"
                }`
              }
            >
              {item.shortLabel}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
