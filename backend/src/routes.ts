import { Router } from "express";
import { authRoutes } from "./modules/auth/auth.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { tenantsRoutes } from "./modules/tenants/tenants.routes";
import { clientsRoutes } from "./modules/clients/clients.routes";
import { servicesRoutes } from "./modules/services/services.routes";
import { appointmentsRoutes } from "./modules/appointments/appointments.routes";
import { paymentsRoutes } from "./modules/payments/payments.routes";
import { commissionsRoutes } from "./modules/commissions/commissions.routes";
import { expensesRoutes } from "./modules/expenses/expenses.routes";
import { productsRoutes } from "./modules/products/products.routes";
import { inventoryRoutes } from "./modules/inventory/inventory.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { authMiddleware } from "./middlewares/auth.middleware";
import { tenantMiddleware } from "./middlewares/tenant.middleware";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "barbearia-api" });
});

apiRouter.use("/auth", authRoutes);
apiRouter.use(authMiddleware);
apiRouter.use(tenantMiddleware);
apiRouter.use("/users", usersRoutes);
apiRouter.use("/tenants", tenantsRoutes);
apiRouter.use("/clients", clientsRoutes);
apiRouter.use("/services", servicesRoutes);
apiRouter.use("/appointments", appointmentsRoutes);
apiRouter.use("/payments", paymentsRoutes);
apiRouter.use("/commissions", commissionsRoutes);
apiRouter.use("/expenses", expensesRoutes);
apiRouter.use("/products", productsRoutes);
apiRouter.use("/inventory", inventoryRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
