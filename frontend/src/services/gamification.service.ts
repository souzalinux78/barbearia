import { api } from "./api";

export type GoalType = "REVENUE" | "APPOINTMENTS" | "SERVICES" | "TICKET_AVG" | "UPSELL";
export type GoalPeriod = "DAILY" | "WEEKLY" | "MONTHLY";
export type QuickRange = "TODAY" | "7D" | "30D" | "MONTH" | "CUSTOM";

export type GoalItem = {
  id: string;
  tenantId: string;
  unitId: string | null;
  userId: string | null;
  type: GoalType;
  period: GoalPeriod;
  targetValue: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  progress: {
    currentValue: number;
    percentage: number;
  };
};

export type GoalsResponse = {
  items: GoalItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type ProgressResponse = {
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalGoals: number;
    reachedGoals: number;
    averageProgress: number;
    points: number;
    myPosition: number | null;
  };
  goals: GoalItem[];
};

export type RankingItem = {
  userId: string;
  userName: string;
  points: number;
  revenue: number;
  goalsHit: number;
  score: number;
  position: number;
  medal: "GOLD" | "SILVER" | "BRONZE" | "NONE";
};

export type RankingResponse = {
  period: {
    start: string;
    end: string;
  };
  unitRanking: RankingItem[];
  franchiseRanking: RankingItem[];
};

export type BadgesResponse = {
  catalog: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    ruleType: string;
    ruleValue: number;
    createdAt: string;
  }>;
  earned: Array<{
    id: string;
    userId: string;
    userName: string;
    badgeId: string;
    badgeName: string;
    badgeIcon: string;
    achievedAt: string;
  }>;
};

export type ChallengesResponse = {
  period: {
    start: string;
    end: string;
  };
  items: Array<{
    id: string;
    name: string;
    description: string;
    targetType: GoalType;
    targetValue: number;
    rewardPoints: number;
    active: boolean;
    startDate: string;
    endDate: string;
    completionRate: number;
    participants: Array<{
      userId: string;
      userName: string;
      currentValue: number;
      percentage: number;
      achieved: boolean;
    }>;
  }>;
};

export const getGamificationGoals = async (params?: {
  quick?: QuickRange;
  start?: string;
  end?: string;
  type?: GoalType;
  periodType?: GoalPeriod;
  onlyOpen?: boolean;
  page?: number;
  pageSize?: number;
}) => {
  const { data } = await api.get<GoalsResponse>("/gamification/goals", { params });
  return data;
};

export const getGamificationProgress = async (params?: {
  quick?: QuickRange;
  start?: string;
  end?: string;
  type?: GoalType;
}) => {
  const { data } = await api.get<ProgressResponse>("/gamification/progress", { params });
  return data;
};

export const getGamificationRanking = async (params?: {
  quick?: QuickRange;
  start?: string;
  end?: string;
  scope?: "UNIT" | "FRANCHISE";
  limit?: number;
}) => {
  const { data } = await api.get<RankingResponse>("/gamification/ranking", { params });
  return data;
};

export const getGamificationBadges = async (params?: { userId?: string }) => {
  const { data } = await api.get<BadgesResponse>("/gamification/badges", { params });
  return data;
};

export const getGamificationChallenges = async (params?: {
  quick?: QuickRange;
  start?: string;
  end?: string;
  activeOnly?: boolean;
}) => {
  const { data } = await api.get<ChallengesResponse>("/gamification/challenges", { params });
  return data;
};

export const createGamificationGoal = async (payload: {
  type: GoalType;
  targetValue: number;
  period: GoalPeriod;
  startDate: string;
  endDate: string;
  unitId?: string;
  userId?: string;
}) => {
  const { data } = await api.post<GoalItem>("/gamification/create-goal", payload);
  return data;
};

export const createGamificationChallenge = async (payload: {
  name: string;
  description: string;
  targetType: GoalType;
  targetValue: number;
  rewardPoints: number;
  startDate: string;
  endDate: string;
  active?: boolean;
}) => {
  const { data } = await api.post("/gamification/create-challenge", payload);
  return data;
};

