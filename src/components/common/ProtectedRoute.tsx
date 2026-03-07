import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/newAuthStore';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { ModuleAccess, resolvePlanAccess } from '@/features/subscriptions/planAccess';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredAccess?: ModuleAccess;
}

export function ProtectedRoute({ children, requiredAccess }: ProtectedRouteProps) {
  const { isAuthenticated, user, authChecked } = useAuthStore();
  const { userData, isLoading, requiresSubscriptionSelection } = useProfessional();
  const location = useLocation();
  const activeUser = user ?? userData;
  const planAccess = resolvePlanAccess(activeUser ?? null);
  const onboardingStatus = activeUser?.onboarding_status;
  const needsOnboarding = Boolean(
    activeUser && onboardingStatus && onboardingStatus.toLowerCase() !== 'completed'
  );
  const isOnboardingPath = location.pathname.startsWith('/onboarding');
  const isProfilePath = location.pathname.startsWith('/profile');
  const isSubscriptionFlowPath = location.pathname.startsWith('/subscriptions/');

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
          <span className="text-sm font-medium text-gray-600">Cargando sesión...</span>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (isAuthenticated && !activeUser && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
          <span className="text-sm font-medium text-gray-600">Cargando sesión...</span>
        </div>
      </div>
    );
  }

  if (needsOnboarding && !isOnboardingPath) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!needsOnboarding && isOnboardingPath) {
    return <Navigate to="/" replace />;
  }

  if (requiresSubscriptionSelection && !isProfilePath && !isOnboardingPath && !isSubscriptionFlowPath) {
    return <Navigate to="/subscriptions/plans" replace />;
  }

  if (requiredAccess && activeUser) {
    const canAccessModule =
      requiredAccess === 'nutrition'
        ? planAccess.canAccessNutrition
        : planAccess.canAccessTraining;

    if (!canAccessModule) {
      return <Navigate to={planAccess.firstAllowedRoute} replace />;
    }
  }

  // Check role if required
  // if (requiredRole && user?.role !== requiredRole) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center">
  //       <div className="text-center">
  //         <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
  //         <p className="text-gray-600">You don't have permission to access this page.</p>
  //       </div>
  //     </div>
  //   );
  // }

  return <>{children}</>;
}
