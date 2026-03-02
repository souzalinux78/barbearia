import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import {
  getMasterBillingConfig,
  getMasterChurn,
  getMasterFunnel,
  getMasterMrr,
  getMasterPlans,
  getMasterPlatformMetrics,
  getMasterRevenue,
  getMasterRevenueProjection,
  getMasterSummary,
  getMasterTenantById,
  getMasterTenants,
  impersonateTenant,
  updateMasterBillingConfig,
  updateMasterPlan,
  updateMasterTenantStatus
} from "./master.service";
import {
  MasterBillingConfigInput,
  MasterFunnelQueryInput,
  MasterImpersonateInput,
  MasterPeriodQueryInput,
  MasterPlanNameParamInput,
  MasterPlanUpdateInput,
  MasterRevenueQueryInput,
  MasterTenantStatusPatchInput,
  MasterTenantsQueryInput
} from "./master.schemas";

const getScope = (req: Request) => ({
  adminId: req.masterAuth!.adminId,
  email: req.masterAuth!.email,
  role: req.masterAuth!.role
});

export const masterSummaryController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMasterSummary(getScope(req));
  res.status(200).json(result);
});

export const masterMrrController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMasterMrr(
    getScope(req),
    req.query as unknown as MasterPeriodQueryInput
  );
  res.status(200).json(result);
});

export const masterChurnController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMasterChurn(
    getScope(req),
    req.query as unknown as MasterPeriodQueryInput
  );
  res.status(200).json(result);
});

export const masterFunnelController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMasterFunnel(
    getScope(req),
    req.query as unknown as MasterFunnelQueryInput
  );
  res.status(200).json(result);
});

export const masterTenantsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMasterTenants(
    getScope(req),
    req.query as unknown as MasterTenantsQueryInput
  );
  res.status(200).json(result);
});

export const masterTenantByIdController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMasterTenantById(getScope(req), String(req.params.id));
  res.status(200).json(result);
});

export const masterTenantStatusController = asyncHandler(async (req: Request, res: Response) => {
  const result = await updateMasterTenantStatus(
    getScope(req),
    String(req.params.id),
    req.body as MasterTenantStatusPatchInput
  );
  res.status(200).json(result);
});

export const masterPlatformMetricsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMasterPlatformMetrics(
    getScope(req),
    req.query as unknown as MasterPeriodQueryInput
  );
  res.status(200).json(result);
});

export const masterRevenueProjectionController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMasterRevenueProjection(getScope(req));
  res.status(200).json(result);
});

export const masterRevenueController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMasterRevenue(
    getScope(req),
    req.query as unknown as MasterRevenueQueryInput
  );
  res.status(200).json(result);
});

export const masterBillingConfigController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMasterBillingConfig(getScope(req));
  res.status(200).json(result);
});

export const masterPlansController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getMasterPlans(getScope(req));
  res.status(200).json(result);
});

export const masterPlanUpdateController = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params as unknown as MasterPlanNameParamInput;
  const result = await updateMasterPlan(getScope(req), name, req.body as MasterPlanUpdateInput);
  res.status(200).json(result);
});

export const masterBillingConfigUpdateController = asyncHandler(async (req: Request, res: Response) => {
  const result = await updateMasterBillingConfig(
    getScope(req),
    req.body as MasterBillingConfigInput
  );
  res.status(200).json(result);
});

export const masterImpersonateController = asyncHandler(async (req: Request, res: Response) => {
  const result = await impersonateTenant(
    getScope(req),
    String(req.params.id),
    req.body as MasterImpersonateInput
  );
  res.status(200).json(result);
});
