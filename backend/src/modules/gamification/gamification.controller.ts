import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import {
  createGamificationChallenge,
  createGamificationGoal,
  getGamificationBadges,
  getGamificationChallenges,
  getGamificationGoals,
  getGamificationProgress,
  getGamificationRanking
} from "./gamification.service";
import {
  CreateChallengeInput,
  CreateGoalInput,
  GamificationBadgesQueryInput,
  GamificationChallengesQueryInput,
  GamificationGoalsQueryInput,
  GamificationProgressQueryInput,
  GamificationRankingQueryInput
} from "./gamification.schemas";

const getScope = (req: Request) => ({
  tenantId: req.auth!.tenantId,
  userId: req.auth!.userId,
  role: req.auth!.role,
  unitId: req.hierarchy!.unitId,
  franchiseId: req.hierarchy!.franchiseId
});

export const gamificationGoalsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getGamificationGoals(
    getScope(req),
    req.query as unknown as GamificationGoalsQueryInput
  );
  res.status(200).json(result);
});

export const gamificationProgressController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getGamificationProgress(
    getScope(req),
    req.query as unknown as GamificationProgressQueryInput
  );
  res.status(200).json(result);
});

export const gamificationRankingController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getGamificationRanking(
    getScope(req),
    req.query as unknown as GamificationRankingQueryInput
  );
  res.status(200).json(result);
});

export const gamificationBadgesController = asyncHandler(async (req: Request, res: Response) => {
  const result = await getGamificationBadges(
    getScope(req),
    req.query as unknown as GamificationBadgesQueryInput
  );
  res.status(200).json(result);
});

export const gamificationChallengesController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getGamificationChallenges(
      getScope(req),
      req.query as unknown as GamificationChallengesQueryInput
    );
    res.status(200).json(result);
  }
);

export const createGoalController = asyncHandler(async (req: Request, res: Response) => {
  const result = await createGamificationGoal(getScope(req), req.body as CreateGoalInput);
  res.status(201).json(result);
});

export const createChallengeController = asyncHandler(async (req: Request, res: Response) => {
  const result = await createGamificationChallenge(getScope(req), req.body as CreateChallengeInput);
  res.status(201).json(result);
});

