import React, { Suspense } from 'react';

class MicrofrontendErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Microfrontend Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-4 border border-red-200 rounded-lg bg-red-50 text-red-800">
            <h3 className="font-semibold">Microfrontend Unavailable</h3>
            <p className="text-sm mt-1">
              Failed to load the requested module. Please ensure the microfrontend service is running.
            </p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

interface RemoteWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
}

/**
 * Wrapper component for loading Microfrontends safely.
 * Handles Suspense (loading state) and Error Boundaries (failure state).
 */
export const RemoteWrapper: React.FC<RemoteWrapperProps> = ({
  children,
  fallback = (
    <div className="flex items-center justify-center p-8 h-full min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  ),
  errorFallback,
}) => {
  return (
    <MicrofrontendErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </MicrofrontendErrorBoundary>
  );
};
