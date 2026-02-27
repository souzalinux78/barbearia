import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { getOverview } from "./dashboard.service";

export const dashboardOverviewController = asyncHandler(async (req: Request, res: Response) => {
  const data = await getOverview(req.auth!.tenantId);
  res.status(200).json(data);
});
