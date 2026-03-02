import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { MarketingEventInput } from "./marketing.schemas";
import { ingestMarketingEvent } from "./marketing.service";

export const ingestMarketingEventController = asyncHandler(async (req: Request, res: Response) => {
  const result = await ingestMarketingEvent(req.body as MarketingEventInput, req.ip);
  res.status(202).json(result);
});

