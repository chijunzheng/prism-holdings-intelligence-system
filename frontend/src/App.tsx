import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './contexts/AppContext'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { ProfileSwitcher } from './components/shared/ProfileSwitcher'
import { PortfolioView } from './routes/PortfolioView'
import { CausalGraphView } from './routes/CausalGraphView'

export function App() {
  return (
    <AppProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <ProfileSwitcher />
          <Routes>
            <Route path="/" element={<Navigate to="/portfolio" replace />} />
            <Route path="/portfolio" element={<PortfolioView />} />
            <Route path="/graph/:signalId" element={<CausalGraphView />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </AppProvider>
  )
}
