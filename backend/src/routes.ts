import { Router } from "express";
import { authRoutes } from "./modules/auth/auth.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { tenantsRoutes } from "./modules/tenants/tenants.routes";
import { clientsRoutes } from "./modules/clients/clients.routes";
import { servicesRoutes } from "./modules/services/services.routes";
import { appointmentsRoutes } from "./modules/appointments/appointments.routes";
import { productsRoutes } from "./modules/products/products.routes";
import { inventoryRoutes } from "./modules/inventory/inventory.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { financialRoutes } from "./modules/financial/financial.routes";
import { billingProtectedRoutes, billingPublicRoutes } from "./modules/billing/billing.routes";
import { notificationsRoutes } from "./modules/notifications/notifications.routes";
import { crmRoutes } from "./modules/crm/crm.routes";
import { franchiseRoutes } from "./modules/franchise/franchise.routes";
import { whatsappProtectedRoutes, whatsappPublicRoutes } from "./modules/whatsapp/whatsapp.routes";
import { automationRoutes } from "./modules/automation/automation.routes";
import { gamificationRoutes } from "./modules/gamification/gamification.routes";
import { masterAuthRoutes } from "./modules/master/master-auth.routes";
import { masterRoutes } from "./modules/master/master.routes";
import { publicBookingRoutes } from "./modules/public-booking/public-booking.routes";
import { marketingPublicRoutes } from "./modules/marketing/marketing.routes";
import { authMiddleware } from "./middlewares/auth.middleware";
import { tenantMiddleware } from "./middlewares/tenant.middleware";
import { hierarchyMiddleware } from "./middlewares/hierarchy.middleware";
import { checkSubscriptionStatus } from "./middlewares/subscription-status.middleware";
import { prisma } from "./config/prisma";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "barbearia-api" });
});

apiRouter.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ready",
      database: "ok"
    });
  } catch {
    res.status(503).json({
      status: "not_ready",
      database: "error"
    });
  }
});

apiRouter.use("/auth", authRoutes);
apiRouter.use("/admin", masterAuthRoutes);
apiRouter.use("/billing", billingPublicRoutes);
apiRouter.use("/whatsapp", whatsappPublicRoutes);
apiRouter.use("/public/booking", publicBookingRoutes);
apiRouter.use("/marketing", marketingPublicRoutes);
apiRouter.use("/master", masterRoutes);
apiRouter.use(authMiddleware);
apiRouter.use(tenantMiddleware);
apiRouter.use(hierarchyMiddleware);
apiRouter.use("/billing", billingProtectedRoutes);
apiRouter.use(checkSubscriptionStatus);
apiRouter.use("/users", usersRoutes);
apiRouter.use("/tenants", tenantsRoutes);
apiRouter.use("/clients", clientsRoutes);
apiRouter.use("/services", servicesRoutes);
apiRouter.use("/appointments", appointmentsRoutes);
apiRouter.use("/financial", financialRoutes);
apiRouter.use("/products", productsRoutes);
apiRouter.use("/inventory", inventoryRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
apiRouter.use("/notifications", notificationsRoutes);
apiRouter.use("/crm", crmRoutes);
apiRouter.use("/franchise", franchiseRoutes);
apiRouter.use("/whatsapp", whatsappProtectedRoutes);
apiRouter.use("/automation", automationRoutes);
apiRouter.use("/gamification", gamificationRoutes);
