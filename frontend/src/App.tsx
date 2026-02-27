import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './contexts/AppContext'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { AppLayout } from './components/shared/AppLayout'
import { PortfolioView } from './routes/PortfolioView'
import { SignalsLayout } from './routes/signals/SignalsLayout'
import { CombinedSignalsPane } from './routes/signals/CombinedSignalsPane'
import { SignalDetailPane } from './routes/signals/SignalDetailPane'
import { PlanView } from './routes/signal/PlanView'
import { PlaybookView } from './routes/PlaybookView'

export function App() {
  return (
    <AppProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/portfolio" replace />} />
              <Route path="/portfolio" element={<PortfolioView />} />
              <Route path="/signals" element={<SignalsLayout />}>
                <Route index element={<CombinedSignalsPane />} />
                <Route path=":signalId" element={<SignalDetailPane />} />
              </Route>
              <Route path="/signals/:signalId/plan" element={<PlanView />} />
              <Route path="/playbook" element={<PlaybookView />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </AppProvider>
  )
}
