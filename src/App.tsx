import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { TrainingTemplatesPage } from './pages/TrainingTemplatesPage';
import { MesocycleEditorPage } from './pages/MesocycleEditorPage';
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

function LegacyMesocycleRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/training/programs/${id}` : '/training/programs'} replace />;
}

function App() {
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

      <Routes>
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
            <ProtectedRoute>
              <MainLayout>
                <ExercisesPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/training/programs"
          element={
            <ProtectedRoute>
              <MainLayout>
                <TrainingTemplatesPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/training/programs/new"
          element={
            <ProtectedRoute>
              <MainLayout>
                <MesocycleEditorPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/training/programs/:id"
          element={
            <ProtectedRoute>
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
          path="/ai-generator"
          element={<Navigate to="/training/programs" replace />}
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
          <Route path="clients/:clientId/medical-history" element={<NutritionClientMedicalHistoryPage />} />
          <Route path="clients/:clientId" element={<NutritionClientDetailPage />} />
          <Route path="consultation/:id" element={<NutritionConsultationPage />} />
          <Route path="meal-plans" element={<MealPlansLayout />}>
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
