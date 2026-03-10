import { User } from '@/types/api';

export type ModuleAccess = 'nutrition' | 'training';

export type ResolvedPlanAccess = {
  hasSubscriptionAccess: boolean;
  canAccessNutrition: boolean;
  canAccessTraining: boolean;
  maxClients: number | null;
  isUnlimitedClients: boolean;
  currentPlanId: number | null;
  currentPlanName: string | null;
  firstAllowedRoute: string;
};

export type TrainingAIAccessReason =
  | 'ok'
  | 'missing_user'
  | 'missing_plan'
  | 'missing_trainer_role';

export type ResolvedTrainingAIAccess = {
  canAccess: boolean;
  reason: TrainingAIAccessReason;
  firstAllowedRoute: string;
};

type UserRoleSource = Pick<User, 'professional_role'> & {
  professional_roles?: unknown;
  professionalRole?: unknown;
  professionalRoles?: unknown;
};

const NUTRITION_DENIED_MESSAGE =
  'Necesitas un plan con acceso a nutricion para usar este modulo.';
const TRAINING_DENIED_MESSAGE =
  'Necesitas un plan con acceso a entrenamiento para usar este modulo.';

const normalizePlanName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .trim();

const parsePlanId = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const getCurrentPlanId = (user: User | null): number | null => {
  const subscription = user?.current_subscription;
  if (!subscription) {
    return null;
  }

  const directPlanId = parsePlanId(subscription.plan_id);
  if (directPlanId) {
    return directPlanId;
  }

  if (subscription.plan && typeof subscription.plan === 'object' && 'id' in subscription.plan) {
    return parsePlanId(subscription.plan.id);
  }

  if (subscription.plan_details && typeof subscription.plan_details === 'object') {
    return parsePlanId(subscription.plan_details.id);
  }

  return null;
};

const getCurrentPlanName = (user: User | null): string | null => {
  const subscription = user?.current_subscription;
  if (!subscription) {
    return null;
  }

  if (typeof subscription.plan === 'string' && subscription.plan.trim()) {
    return subscription.plan.trim();
  }

  if (subscription.plan && typeof subscription.plan === 'object' && 'name' in subscription.plan) {
    const value = subscription.plan.name;
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  if (typeof subscription.name === 'string' && subscription.name.trim()) {
    return subscription.name.trim();
  }

  if (subscription.plan_details && typeof subscription.plan_details === 'object') {
    const value = subscription.plan_details.name;
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const getFirstAllowedRoute = (canAccessNutrition: boolean, canAccessTraining: boolean) => {
  if (canAccessNutrition) {
    return '/';
  }

  if (canAccessTraining) {
    return '/training/programs';
  }

  return '/subscriptions/plans';
};

const getPlanRule = (planId: number | null, planName: string | null) => {
  const normalizedName = planName ? normalizePlanName(planName) : '';

  if (planId === 1 || normalizedName === 'starter') {
    return {
      canAccessNutrition: true,
      canAccessTraining: true,
      maxClients: 10,
    };
  }

  if (planId === 2 || normalizedName === 'nutritionpro') {
    return {
      canAccessNutrition: true,
      canAccessTraining: false,
      maxClients: null,
    };
  }

  if (planId === 3 || normalizedName === 'trainingpro') {
    return {
      canAccessNutrition: false,
      canAccessTraining: true,
      maxClients: null,
    };
  }

  if (planId === 4 || normalizedName === 'fitpilotultimate') {
    return {
      canAccessNutrition: true,
      canAccessTraining: true,
      maxClients: null,
    };
  }

  return {
    canAccessNutrition: false,
    canAccessTraining: false,
    maxClients: null,
  };
};

const normalizeRoleName = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const collectRoleValues = (raw: unknown, target: Set<string>) => {
  if (!raw) {
    return;
  }

  const addRole = (value: unknown) => {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized) {
      target.add(normalized);
    }
  };

  if (typeof raw === 'string') {
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach(addRole);
    return;
  }

  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      if (item && typeof item === 'object') {
        const maybeRole = (item as Record<string, unknown>).role
          ?? (item as Record<string, unknown>).name
          ?? (item as Record<string, unknown>).value;
        addRole(maybeRole);
        return;
      }
      addRole(item);
    });
    return;
  }

  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const maybeNested = record.role ?? record.name ?? record.value;
    if (Array.isArray(maybeNested) || typeof maybeNested === 'string') {
      collectRoleValues(maybeNested, target);
      return;
    }
    addRole(maybeNested);
  }
};

const mergeProfessionalRoleSources = (
  roles: Set<string>,
  source: UserRoleSource | null | undefined,
) => {
  if (!source) {
    return;
  }

  collectRoleValues(source.professional_role, roles);
  collectRoleValues(source.professional_roles, roles);
  collectRoleValues(source.professionalRole, roles);
  collectRoleValues(source.professionalRoles, roles);
};

export const buildTrainingAccessUser = (
  primaryUser: User | null | undefined,
  fallbackUser?: User | null | undefined,
  professionalSource?: Partial<UserRoleSource> | null,
): User | null => {
  const baseUser = primaryUser ?? fallbackUser ?? null;
  if (!baseUser) {
    return null;
  }

  const mergedRoles = new Set<string>();
  mergeProfessionalRoleSources(mergedRoles, baseUser as UserRoleSource);
  mergeProfessionalRoleSources(mergedRoles, professionalSource as UserRoleSource | null);

  if (!mergedRoles.size) {
    return baseUser;
  }

  return {
    ...baseUser,
    professional_role: Array.from(mergedRoles),
  };
};

const getProfessionalRoles = (user: User | null): Set<string> => {
  const roles = new Set<string>();

  const candidates = [
    (user as Record<string, unknown> | null)?.professional_role,
    (user as Record<string, unknown> | null)?.professional_roles,
    (user as Record<string, unknown> | null)?.professionalRole,
    (user as Record<string, unknown> | null)?.professionalRoles,
  ];
  candidates.forEach((candidate) => collectRoleValues(candidate, roles));

  // Backward compatibility for accounts whose effective auth role is `trainer`
  const normalizedRole = normalizeRoleName(user?.role);
  if (!roles.size && normalizedRole === 'trainer') {
    roles.add('TRAINER');
  }

  return roles;
};

export const resolvePlanAccess = (user: User | null): ResolvedPlanAccess => {
  const hasSubscriptionAccess =
    user?.has_active_subscription === true ||
    user?.subscription_vigency?.is_vigent === true;

  const currentPlanId = getCurrentPlanId(user);
  const currentPlanName = getCurrentPlanName(user);

  if (!hasSubscriptionAccess) {
    return {
      hasSubscriptionAccess: false,
      canAccessNutrition: false,
      canAccessTraining: false,
      maxClients: null,
      isUnlimitedClients: false,
      currentPlanId,
      currentPlanName,
      firstAllowedRoute: '/subscriptions/plans',
    };
  }

  const planRule = getPlanRule(currentPlanId, currentPlanName);

  return {
    hasSubscriptionAccess: true,
    canAccessNutrition: planRule.canAccessNutrition,
    canAccessTraining: planRule.canAccessTraining,
    maxClients: planRule.maxClients,
    isUnlimitedClients: planRule.maxClients === null,
    currentPlanId,
    currentPlanName,
    firstAllowedRoute: getFirstAllowedRoute(
      planRule.canAccessNutrition,
      planRule.canAccessTraining,
    ),
  };
};

export const resolveTrainingAIAccess = (user: User | null): ResolvedTrainingAIAccess => {
  if (!user) {
    return {
      canAccess: false,
      reason: 'missing_user',
      firstAllowedRoute: '/auth/login',
    };
  }

  const role = normalizeRoleName(user.role);
  const isAdmin = role === 'admin' || role === 'administrator' || role === 'super_admin';
  const planAccess = resolvePlanAccess(user);

  if (isAdmin) {
    return {
      canAccess: true,
      reason: 'ok',
      firstAllowedRoute: planAccess.firstAllowedRoute,
    };
  }

  if (!planAccess.canAccessTraining) {
    return {
      canAccess: false,
      reason: 'missing_plan',
      firstAllowedRoute: planAccess.firstAllowedRoute,
    };
  }

  const roles = getProfessionalRoles(user);
  if (!roles.has('TRAINER')) {
    return {
      canAccess: false,
      reason: 'missing_trainer_role',
      firstAllowedRoute: planAccess.firstAllowedRoute,
    };
  }

  return {
    canAccess: true,
    reason: 'ok',
    firstAllowedRoute: planAccess.firstAllowedRoute,
  };
};

export const hasModuleAccess = (user: User | null, module: ModuleAccess): boolean => {
  const access = resolvePlanAccess(user);
  return module === 'nutrition' ? access.canAccessNutrition : access.canAccessTraining;
};

export const assertModuleAccess = (user: User | null, module: ModuleAccess) => {
  if (hasModuleAccess(user, module)) {
    return;
  }

  throw new Error(module === 'nutrition' ? NUTRITION_DENIED_MESSAGE : TRAINING_DENIED_MESSAGE);
};

export const hasNutritionSubscriptionAccess = (user: User | null) =>
  hasModuleAccess(user, 'nutrition');

export const hasTrainingSubscriptionAccess = (user: User | null) =>
  hasModuleAccess(user, 'training');

export const assertNutritionSubscriptionAccess = (user: User | null) =>
  assertModuleAccess(user, 'nutrition');

export const assertTrainingSubscriptionAccess = (user: User | null) =>
  assertModuleAccess(user, 'training');
