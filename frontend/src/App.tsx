import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './contexts/AppContext'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { ProfileSwitcher } from './components/shared/ProfileSwitcher'
import { AppLayout } from './components/shared/AppLayout'
import { PortfolioView } from './routes/PortfolioView'
import { ImpactAnalysisView } from './routes/ImpactAnalysisView'
import { InsightsView } from './routes/InsightsView'

export function App() {
  return (
    <AppProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <ProfileSwitcher />
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/portfolio" replace />} />
              <Route path="/portfolio" element={<PortfolioView />} />
              <Route path="/signals" element={<ImpactAnalysisView />} />
              <Route path="/ask" element={<InsightsView />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </AppProvider>
  )
}
