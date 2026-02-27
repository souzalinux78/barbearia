import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import {
  getAdvancedMetrics,
  getBarberMetrics,
  getClientMetrics,
  getDashboardOverviewLegacy,
  getDashboardSummary,
  getOccupancyMetrics,
  getRevenueMetrics,
  getServiceMetrics,
  exportDashboardData
} from "./dashboard.service";
import {
  AdvancedMetricsQueryInput,
  DashboardPeriodQueryInput,
  ExportQueryInput
} from "./dashboard.schemas";

const getActorFromRequest = (req: Request) => ({
  userId: req.auth!.userId,
  role: req.auth!.role
});

export const dashboardSummaryController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getDashboardSummary(
    req.auth!.tenantId,
    getActorFromRequest(req),
    req.query as unknown as DashboardPeriodQueryInput
  );
  res.status(200).json(result);
});

export const dashboardRevenueController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getRevenueMetrics(
    req.auth!.tenantId,
    getActorFromRequest(req),
    req.query as unknown as DashboardPeriodQueryInput
  );
  res.status(200).json(result);
});

export const dashboardClientsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getClientMetrics(
    req.auth!.tenantId,
    getActorFromRequest(req),
    req.query as unknown as DashboardPeriodQueryInput
  );
  res.status(200).json(result);
});

export const dashboardServicesController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getServiceMetrics(
    req.auth!.tenantId,
    getActorFromRequest(req),
    req.query as unknown as DashboardPeriodQueryInput
  );
  res.status(200).json(result);
});

export const dashboardBarbersController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getBarberMetrics(
    req.auth!.tenantId,
    getActorFromRequest(req),
    req.query as unknown as DashboardPeriodQueryInput
  );
  res.status(200).json(result);
});

export const dashboardOccupancyController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getOccupancyMetrics(
    req.auth!.tenantId,
    getActorFromRequest(req),
    req.query as unknown as DashboardPeriodQueryInput
  );
  res.status(200).json(result);
});

export const dashboardAdvancedMetricsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getAdvancedMetrics(
    req.auth!.tenantId,
    getActorFromRequest(req),
    req.query as unknown as AdvancedMetricsQueryInput
  );
  res.status(200).json(result);
});

export const dashboardExportController = asyncHandler(async (req: Request, res: Response) => {
  const result = await exportDashboardData(
    req.auth!.tenantId,
    getActorFromRequest(req),
    req.query as unknown as ExportQueryInput
  );
  res.status(202).json(result);
});

export const dashboardOverviewController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getDashboardOverviewLegacy(req.auth!.tenantId, getActorFromRequest(req));
  res.status(200).json(result);
});
