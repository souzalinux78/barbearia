import { RoleName } from "@prisma/client";
import rateLimit from "express-rate-limit";
import { Router } from "express";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createChallengeController,
  createGoalController,
  gamificationBadgesController,
  gamificationChallengesController,
  gamificationGoalsController,
  gamificationProgressController,
  gamificationRankingController
} from "./gamification.controller";
import {
  createChallengeSchema,
  createGoalSchema,
  gamificationBadgesQuerySchema,
  gamificationChallengesQuerySchema,
  gamificationGoalsQuerySchema,
  gamificationProgressQuerySchema,
  gamificationRankingQuerySchema
} from "./gamification.schemas";

const gamificationRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});

export const gamificationRoutes = Router();

gamificationRoutes.get(
  "/goals",
  gamificationRateLimit,
  authorize(
    RoleName.OWNER,
    RoleName.ADMIN,
    RoleName.BARBER,
    RoleName.RECEPTION,
    RoleName.FRANCHISE_OWNER
  ),
  validate(gamificationGoalsQuerySchema, "query"),
  gamificationGoalsController
);

gamificationRoutes.get(
  "/progress",
  gamificationRateLimit,
  authorize(
    RoleName.OWNER,
    RoleName.ADMIN,
    RoleName.BARBER,
    RoleName.RECEPTION,
    RoleName.FRANCHISE_OWNER
  ),
  validate(gamificationProgressQuerySchema, "query"),
  gamificationProgressController
);

gamificationRoutes.get(
  "/ranking",
  gamificationRateLimit,
  authorize(
    RoleName.OWNER,
    RoleName.ADMIN,
    RoleName.BARBER,
    RoleName.RECEPTION,
    RoleName.FRANCHISE_OWNER
  ),
  validate(gamificationRankingQuerySchema, "query"),
  gamificationRankingController
);

gamificationRoutes.get(
  "/badges",
  gamificationRateLimit,
  authorize(
    RoleName.OWNER,
    RoleName.ADMIN,
    RoleName.BARBER,
    RoleName.RECEPTION,
    RoleName.FRANCHISE_OWNER
  ),
  validate(gamificationBadgesQuerySchema, "query"),
  gamificationBadgesController
);

gamificationRoutes.get(
  "/challenges",
  gamificationRateLimit,
  authorize(
    RoleName.OWNER,
    RoleName.ADMIN,
    RoleName.BARBER,
    RoleName.RECEPTION,
    RoleName.FRANCHISE_OWNER
  ),
  validate(gamificationChallengesQuerySchema, "query"),
  gamificationChallengesController
);

gamificationRoutes.post(
  "/create-goal",
  gamificationRateLimit,
  authorize(RoleName.OWNER, RoleName.UNIT_OWNER),
  validate(createGoalSchema),
  createGoalController
);

gamificationRoutes.post(
  "/create-challenge",
  gamificationRateLimit,
  authorize(RoleName.OWNER, RoleName.UNIT_OWNER),
  validate(createChallengeSchema),
  createChallengeController
);

