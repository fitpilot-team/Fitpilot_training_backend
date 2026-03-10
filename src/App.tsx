import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { TrainingTemplatesPage } from './pages/TrainingTemplatesPage';
import { TrainingClientPlansPage } from './pages/TrainingClientPlansPage';
import { MesocycleEditorPage } from './pages/MesocycleEditorPage';
import { AIGeneratorPage } from './pages/AIGeneratorPage';
import { MainLayout } from './components/layout/MainLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { NutritionClientsPage } from './pages/nutrition/NutritionClientsPage';
import { NutritionDashboardPage } from './pages/nutrition/NutritionDashboardPage';
import { NutritionAgendaPage } from './pages/nutrition/NutritionAgendaPage';
import { NutritionLayout } from './components/layout/NutritionLayout';
import { NutritionClientDetailPage } from './pages/nutrition/NutritionClientDetailPage';
import { NutritionClientMedicalHistoryPage } from './pages/nutrition/NutritionClientMedicalHistoryPage';
import { NutritionConsultationPage } from './pages/nutrition/NutritionConsultationPage';
import { ProfilePage } from './pages/ProfilePage';
import { AuthLayout } from './components/layout/AuthLayout';
import { MealPlansLayout } from './pages/nutrition/meal-plans/MealPlansLayout';
import { MealOverviewPage } from './pages/nutrition/meal-plans/MealOverviewPage';
import { MealBuilderPage } from './pages/nutrition/meal-plans/MealBuilderPage';
import { MealTemplatesPage } from './pages/nutrition/meal-plans/MealTemplatesPage';
import { MenuCreationPage } from './pages/nutrition/meal-plans/MenuCreationPage';
import { ReusableMenusPage } from './pages/nutrition/meal-plans/ReusableMenusPage';
import { ClientsMenusPage } from './pages/nutrition/meal-plans/ClientsMenusPage';
import { ClientWeeklyMenuView } from './pages/nutrition/meal-plans/ClientWeeklyMenuView';
import { RegisterClientPage } from './pages/nutrition/RegisterClientPage';
import { DraftMenusPage } from './pages/nutrition/meal-plans/DraftMenusPage';
import { ProfessionalOnboardingPage } from './pages/onboarding/ProfessionalOnboardingPage';
import { SubscriptionPlansPage } from './pages/SubscriptionPlansPage';
import { CheckoutSuccessPage } from './pages/CheckoutSuccessPage';
import { CheckoutCancelPage } from './pages/CheckoutCancelPage';
import i18n from './i18n';
import {
  getLanguageFromPathname,
  normalizeToSupportedLanguage,
  stripLanguageFromPathname,
  withLanguagePrefix,
} from './utils/languageRouting';
function LegacyMesocycleRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/training/programs/${id}` : '/training/programs'} replace />;
}

function LegacyAIGeneratorRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={`/training/ai-generator${location.search || ''}${location.hash || ''}`}
      replace
    />
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentLanguage = normalizeToSupportedLanguage(i18n.resolvedLanguage || i18n.language);
  const pathnameLanguage = getLanguageFromPathname(location.pathname);
  const routePathname = stripLanguageFromPathname(location.pathname);

  useEffect(() => {
    if (!pathnameLanguage) {
      const prefixedPath = withLanguagePrefix(location.pathname, currentLanguage);
      const targetPath = `${prefixedPath}${location.search}${location.hash}`;
      const currentPath = `${location.pathname}${location.search}${location.hash}`;

      if (targetPath !== currentPath) {
        navigate(targetPath, { replace: true });
      }
      return;
    }

    if (pathnameLanguage !== currentLanguage) {
      i18n.changeLanguage(pathnameLanguage);
    }
  }, [
    currentLanguage,
    pathnameLanguage,
    location.pathname,
    location.search,
    location.hash,
    navigate,
  ]);

  const routesLocation = pathnameLanguage
    ? { ...location, pathname: routePathname }
    : location;

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#363636',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      <Routes location={routesLocation}>
        {/* Public Routes */}
        <Route
          path="/auth"
          element={<AuthLayout />}
        >


          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          {/* <Route path="forgot-password" element={<ForgotPasswordPage />} /> */}
        </Route>

        {/* Protected Routes */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <ProfessionalOnboardingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout>
                <NutritionDashboardPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/training/exercises"
          element={
            <ProtectedRoute requiredAccess="training">
              <MainLayout>
                <ExercisesPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/training/programs"
          element={
            <ProtectedRoute requiredAccess="training">
              <MainLayout>
                <TrainingTemplatesPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/training/client-plans"
          element={
            <ProtectedRoute requiredAccess="training">
              <MainLayout>
                <TrainingClientPlansPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/training/ai-generator"
          element={
            <ProtectedRoute requiredAccess="training">
              <MainLayout>
                <AIGeneratorPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/training/programs/new"
          element={
            <ProtectedRoute requiredAccess="training">
              <MainLayout>
                <MesocycleEditorPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/training/programs/:id"
          element={
            <ProtectedRoute requiredAccess="training">
              <MainLayout>
                <MesocycleEditorPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/exercises"
          element={<Navigate to="/training/exercises" replace />}
        />
        <Route
          path="/templates"
          element={<Navigate to="/training/programs" replace />}
        />
        <Route
          path="/templates/new"
          element={<Navigate to="/training/programs/new" replace />}
        />
        <Route
          path="/templates/:id"
          element={<LegacyMesocycleRedirect />}
        />
        <Route
          path="/mesocycles/:id"
          element={<LegacyMesocycleRedirect />}
        />

        <Route
          path="/training"
          element={<Navigate to="/training/programs" replace />}
        />

        <Route
          path="/clients"
          element={<Navigate to="/nutrition/clients" replace />}
        />
        <Route
          path="/clients/:clientId/*"
          element={<Navigate to="/nutrition/clients" replace />}
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ProfilePage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/subscriptions/plans"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SubscriptionPlansPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/subscriptions/success"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CheckoutSuccessPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/subscriptions/cancel"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CheckoutCancelPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/ai-generator"
          element={<LegacyAIGeneratorRedirect />}
        />


        {/* Nutrition Routes */}
        <Route
          path="/nutrition"
          element={
            <ProtectedRoute>
              <MainLayout>
                <NutritionLayout />
              </MainLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/" replace />} />
          <Route path="agenda" element={<NutritionAgendaPage />} />
          <Route path="clients" element={<NutritionClientsPage />} />
          <Route path="clients/new" element={<RegisterClientPage />} />
          <Route
            path="clients/:clientId/medical-history"
            element={
              <ProtectedRoute requiredAccess="nutrition">
                <NutritionClientMedicalHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="clients/:clientId"
            element={
              <ProtectedRoute requiredAccess="nutrition">
                <NutritionClientDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="consultation/:id"
            element={
              <ProtectedRoute requiredAccess="nutrition">
                <NutritionConsultationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="meal-plans"
            element={
              <ProtectedRoute requiredAccess="nutrition">
                <MealPlansLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<MealOverviewPage />} />
            <Route path="builder" element={<MealBuilderPage />} />
            <Route path="templates" element={<MealTemplatesPage />} />
            <Route path="create-menu" element={<MenuCreationPage />} />
            <Route path="reusable-menus" element={<ReusableMenusPage />} />
            <Route path="clients-menus" element={<ClientsMenusPage />} />
            <Route path="clients-menus/weekly-view/:clientId" element={<ClientWeeklyMenuView />} />
            <Route path="drafts" element={<DraftMenusPage />} />
          </Route>
        </Route>


        {/* Catch all - 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export default App;
