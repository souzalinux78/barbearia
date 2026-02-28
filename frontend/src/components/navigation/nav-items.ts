type NavItem = {
  to: string;
  label: string;
  shortLabel: string;
};

export const sidebarNavItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", shortLabel: "Home" },
  { to: "/appointments", label: "Agenda", shortLabel: "Agenda" },
  { to: "/finance", label: "Financeiro", shortLabel: "Financeiro" },
  { to: "/clients", label: "Clientes", shortLabel: "Clientes" },
  { to: "/crm/loyalty", label: "CRM", shortLabel: "CRM" },
  { to: "/franchise", label: "Franquia", shortLabel: "Franquia" },
  { to: "/automation/rules", label: "Automacao", shortLabel: "Auto" },
  { to: "/performance", label: "Performance", shortLabel: "Meta" },
  { to: "/billing/subscription", label: "Assinatura", shortLabel: "Plano" },
  { to: "/settings", label: "Perfil", shortLabel: "Perfil" }
];

export const bottomNavItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", shortLabel: "Home" },
  { to: "/appointments", label: "Agenda", shortLabel: "Agenda" },
  { to: "/finance", label: "Financeiro", shortLabel: "Financeiro" },
  { to: "/clients", label: "Clientes", shortLabel: "Clientes" },
  { to: "/settings", label: "Perfil", shortLabel: "Perfil" }
];
