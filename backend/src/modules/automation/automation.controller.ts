import { Request, Response } from "express";
import { AutomationRuleType } from "@prisma/client";
import { asyncHandler } from "../../utils/async-handler";
import {
  getAutomationMessages,
  getAutomationMetrics,
  getAutomationRules,
  runAutomationEngineSweep,
  updateAutomationRule
} from "./automation.engine";
import {
  AutomationMetricsQueryInput,
  ListAutomationMessagesQueryInput,
  UpdateAutomationRuleInput
} from "./automation.schemas";

export const automationRulesController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getAutomationRules(req.auth!.tenantId);
  res.status(200).json(result);
});

export const automationRuleUpdateController = asyncHandler(async (req: Request, res: Response) => {
  const result = await updateAutomationRule(
    req.auth!.tenantId,
    String(req.params.type) as AutomationRuleType,
    req.body as UpdateAutomationRuleInput
  );
  res.status(200).json(result);
});

export const automationMessagesController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getAutomationMessages(
    req.auth!.tenantId,
    req.query as unknown as ListAutomationMessagesQueryInput,
    {
      role: req.auth!.role,
      userId: req.auth!.userId
    }
  );
  res.status(200).json(result);
});

export const automationMetricsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getAutomationMetrics(
    req.auth!.tenantId,
    req.query as unknown as AutomationMetricsQueryInput
  );
  res.status(200).json(result);
});

export const automationRunSweepController = asyncHandler(async (_req: Request, res: Response) => {
  const result = await runAutomationEngineSweep();
  res.status(200).json(result);
});
