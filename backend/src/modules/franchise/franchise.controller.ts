import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import {
  generateMonthlyRoyalties,
  getFranchisePerformance,
  getFranchiseRevenue,
  getFranchiseRoyalties,
  getFranchiseSummary,
  getFranchiseUnits
} from "./franchise.service";
import {
  FranchiseQueryInput,
  MonthlyRoyaltyGenerateInput,
  PerformanceQueryInput,
  RoyaltiesQueryInput
} from "./franchise.schemas";

const actorFromRequest = (req: Request) => ({
  userId: req.auth!.userId,
  role: req.auth!.role,
  tenantId: req.auth!.tenantId,
  unitId: req.hierarchy!.unitId,
  franchiseId: req.hierarchy!.franchiseId
});

export const franchiseSummaryController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getFranchiseSummary(
    actorFromRequest(req),
    req.query as unknown as FranchiseQueryInput
  );
  res.status(200).json(result);
});

export const franchiseRevenueController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getFranchiseRevenue(
    actorFromRequest(req),
    req.query as unknown as FranchiseQueryInput
  );
  res.status(200).json(result);
});

export const franchiseUnitsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getFranchiseUnits(
    actorFromRequest(req),
    req.query as unknown as FranchiseQueryInput
  );
  res.status(200).json(result);
});

export const franchiseRoyaltiesController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getFranchiseRoyalties(
    actorFromRequest(req),
    req.query as unknown as RoyaltiesQueryInput
  );
  res.status(200).json(result);
});

export const franchisePerformanceController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getFranchisePerformance(
    actorFromRequest(req),
    req.query as unknown as PerformanceQueryInput
  );
  res.status(200).json(result);
});

export const franchiseGenerateRoyaltiesController = asyncHandler(async (req: Request, res: Response) => {
  const result = await generateMonthlyRoyalties(req.body as MonthlyRoyaltyGenerateInput);
  res.status(200).json(result);
});

