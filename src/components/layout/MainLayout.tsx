import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useProfessional } from '@/contexts/ProfessionalContext';
import { SubscriptionRequiredModal } from '@/components/subscription/SubscriptionRequiredModal';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { requiresSubscriptionSelection } = useProfessional();
  const location = useLocation();
  const isPlansPage = location.pathname.startsWith('/subscriptions/plans');
  const isProfilePage = location.pathname.startsWith('/profile');
  const isOnboardingPage = location.pathname.startsWith('/onboarding');
  const isSubscriptionFlowPage = location.pathname.startsWith('/subscriptions/');
  const shouldHideSidebar = isPlansPage || requiresSubscriptionSelection;
  const shouldShowSubscriptionModal =
    requiresSubscriptionSelection &&
    !isPlansPage &&
    !isProfilePage &&
    !isOnboardingPage &&
    !isSubscriptionFlowPage;

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      {!shouldHideSidebar && <Sidebar />}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header />

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 lg:px-8 max-w-[1920px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      <SubscriptionRequiredModal isOpen={shouldShowSubscriptionModal} />
    </div>
  );
}
