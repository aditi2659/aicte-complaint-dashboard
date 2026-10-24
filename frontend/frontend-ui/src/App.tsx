import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ComplaintProvider } from './context/ComplaintContext';
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

export const App: React.FC = () => {
  return (
    <ComplaintProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </ComplaintProvider>
  );
};

export default App;
