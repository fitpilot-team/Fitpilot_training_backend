import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/newAuthStore';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    // If authenticated but no user loaded, load user
    // if (isAuthenticated && !token) {
    //   loadUser();
    // }
  }, [isAuthenticated, token]);

  // Show loading while checking auth
  // if (isLoading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center">
  //       <LoadingSpinner size="lg" />
  //     </div>
  //   );
  // }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
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
