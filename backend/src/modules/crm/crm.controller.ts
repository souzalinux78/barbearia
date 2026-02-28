import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import {
  getCrmChurnRisk,
  getCrmClientDetails,
  getCrmClients,
  getCrmLtv,
  getCrmOverviewCards,
  getCrmRetention,
  getCrmSegments,
  getCrmVip,
  previewCrmAutomationAudience,
  crmLoyalty,
  runManualLoyaltyExpiration
} from "./crm.service";
import {
  AutomationPreviewInput,
  CrmChurnRiskQueryInput,
  CrmClientsQueryInput,
  CrmLtvQueryInput,
  CrmRetentionQueryInput,
  CrmVipQueryInput,
  LoyaltyProgramUpsertInput,
  LoyaltyRedeemInput
} from "./crm.schemas";

const getScope = (req: Request) => ({
  tenantId: req.auth!.tenantId,
  userId: req.auth!.userId,
  role: req.auth!.role
});

export const crmClientsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getCrmClients(getScope(req), req.query as unknown as CrmClientsQueryInput);
  res.status(200).json(result);
});

export const crmClientDetailsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getCrmClientDetails(getScope(req), String(req.params.id));
  res.status(200).json(result);
});

export const crmSegmentsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getCrmSegments(getScope(req));
  res.status(200).json(result);
});

export const crmRetentionController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getCrmRetention(
    getScope(req),
    req.query as unknown as CrmRetentionQueryInput
  );
  res.status(200).json(result);
});

export const crmLtvController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getCrmLtv(getScope(req), req.query as unknown as CrmLtvQueryInput);
  res.status(200).json(result);
});

export const crmChurnRiskController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getCrmChurnRisk(
    getScope(req),
    req.query as unknown as CrmChurnRiskQueryInput
  );
  res.status(200).json(result);
});

export const crmVipController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getCrmVip(getScope(req), req.query as unknown as CrmVipQueryInput);
  res.status(200).json(result);
});

export const crmOverviewController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getCrmOverviewCards(getScope(req));
  res.status(200).json(result);
});

export const getLoyaltyProgramController = asyncHandler(async (req: Request, res: Response) => {
  const result = await crmLoyalty.getProgram(req.auth!.tenantId);
  res.status(200).json(result);
});

export const upsertLoyaltyProgramController = asyncHandler(async (req: Request, res: Response) => {
  const result = await crmLoyalty.updateProgram(
    req.auth!.tenantId,
    req.body as LoyaltyProgramUpsertInput
  );
  res.status(200).json(result);
});

export const redeemLoyaltyController = asyncHandler(async (req: Request, res: Response) => {
  const result = await crmLoyalty.redeem(req.auth!.tenantId, req.body as LoyaltyRedeemInput);
  res.status(200).json(result);
});

export const automationPreviewController = asyncHandler(async (req: Request, res: Response) => {
  const result = await previewCrmAutomationAudience(
    getScope(req),
    req.body as AutomationPreviewInput
  );
  res.status(200).json(result);
});

export const runExpirationController = asyncHandler(async (req: Request, res: Response) => {
  const result = await runManualLoyaltyExpiration(getScope(req));
  res.status(200).json(result);
});

