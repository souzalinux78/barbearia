type NavItem = {
  to: string;
  label: string;
  shortLabel: string;
  roles: Array<
    | "SUPER_ADMIN"
    | "FRANCHISE_OWNER"
    | "UNIT_OWNER"
    | "UNIT_ADMIN"
    | "OWNER"
    | "ADMIN"
    | "BARBER"
    | "RECEPTION"
  >;
};

const allTenantRoles: NavItem["roles"] = [
  "UNIT_OWNER",
  "UNIT_ADMIN",
  "OWNER",
  "ADMIN",
  "BARBER",
  "RECEPTION"
];

const managerRoles: NavItem["roles"] = [
  "UNIT_OWNER",
  "UNIT_ADMIN",
  "OWNER",
  "ADMIN"
];

const sidebarNavItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", shortLabel: "Home", roles: allTenantRoles },
  { to: "/appointments", label: "Agenda", shortLabel: "Agenda", roles: allTenantRoles },
  {
    to: "/finance",
    label: "Financeiro",
    shortLabel: "Financeiro",
    roles: ["UNIT_OWNER", "UNIT_ADMIN", "OWNER", "ADMIN"]
  },
  { to: "/clients", label: "Clientes", shortLabel: "Clientes", roles: allTenantRoles },
  {
    to: "/users",
    label: "Equipe",
    shortLabel: "Equipe",
    roles: ["UNIT_OWNER", "UNIT_ADMIN", "OWNER", "ADMIN"]
  },
  {
    to: "/services",
    label: "Servicos",
    shortLabel: "Serv",
    roles: ["UNIT_OWNER", "UNIT_ADMIN", "OWNER", "ADMIN"]
  },
  { to: "/crm/loyalty", label: "CRM", shortLabel: "CRM", roles: managerRoles },
  {
    to: "/franchise",
    label: "Franquia",
    shortLabel: "Franquia",
    roles: ["FRANCHISE_OWNER", "SUPER_ADMIN"]
  },
  { to: "/automation/rules", label: "Automacao", shortLabel: "Auto", roles: managerRoles },
  { to: "/performance", label: "Performance", shortLabel: "Meta", roles: managerRoles },
  { to: "/billing/subscription", label: "Assinatura", shortLabel: "Plano", roles: managerRoles },
  { to: "/settings", label: "Perfil", shortLabel: "Perfil", roles: allTenantRoles }
];

const bottomNavItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", shortLabel: "Home", roles: allTenantRoles },
  { to: "/appointments", label: "Agenda", shortLabel: "Agenda", roles: allTenantRoles },
  {
    to: "/finance",
    label: "Financeiro",
    shortLabel: "Financeiro",
    roles: ["UNIT_OWNER", "UNIT_ADMIN", "OWNER", "ADMIN"]
  },
  { to: "/clients", label: "Clientes", shortLabel: "Clientes", roles: allTenantRoles },
  { to: "/settings", label: "Perfil", shortLabel: "Perfil", roles: allTenantRoles }
];

export const getSidebarNavItems = (role?: NavItem["roles"][number]) =>
  sidebarNavItems.filter((item) => (role ? item.roles.includes(role) : false));

export const getBottomNavItems = (role?: NavItem["roles"][number]) =>
  bottomNavItems.filter((item) => (role ? item.roles.includes(role) : false));
