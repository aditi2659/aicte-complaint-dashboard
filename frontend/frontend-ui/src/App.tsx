import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ComplaintProvider } from './context/ComplaintContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppIntroGate } from './components/intro/AppIntroGate';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ComplaintRegistryPage } from './pages/ComplaintRegistryPage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { OverlapCenterPage } from './pages/OverlapCenterPage';
import { InstitutionDirectoryPage } from './pages/InstitutionDirectoryPage';
import { InstitutionProfilePage } from './pages/InstitutionProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminPage } from './pages/AdminPage';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { AuthUser } from './services/authApi';

function AppRoutes() {
  const { user, authChecking, setUser } = useAuth();

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-[#FF69B4] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[#888] text-sm">Initializing secure AICTE dashboard session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={(userData: AuthUser) => setUser(userData)} />;
  }

  return (
    <ComplaintProvider>
      <AppIntroGate>
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="complaints" element={<ComplaintRegistryPage />} />
            <Route path="complaints/:id" element={<CaseDetailPage />} />
            <Route path="overlaps" element={<OverlapCenterPage />} />
            <Route path="institutions" element={<InstitutionDirectoryPage />} />
            <Route path="institutions/:id" element={<InstitutionProfilePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppIntroGate>
    </ComplaintProvider>
  );
}

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
