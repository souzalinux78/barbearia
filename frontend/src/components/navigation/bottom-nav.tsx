import { NavLink } from "react-router-dom";
import { navItems } from "./nav-items";

export const BottomNav = () => (
  <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-charcoal/95 p-2 md:hidden">
    <ul className="grid grid-cols-5 gap-1">
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
