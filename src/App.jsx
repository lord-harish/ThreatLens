import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ThreatProvider } from './context/ThreatContext';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { UploadReportsPage } from './pages/UploadReportsPage';
import { AuditFindingsPage } from './pages/AuditFindingsPage';
import { RiskAnalysisPage } from './pages/RiskAnalysisPage';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <ThemeProvider>
      <ThreatProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="upload" element={<UploadReportsPage />} />
              <Route path="findings" element={<AuditFindingsPage />} />
              <Route path="risk-analysis" element={<RiskAnalysisPage />} />
              <Route path="ai-assistant" element={<AiAssistantPage />} />
              <Route path="404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThreatProvider>
    </ThemeProvider>
  );
}
