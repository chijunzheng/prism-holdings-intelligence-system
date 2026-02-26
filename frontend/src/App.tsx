import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './contexts/AppContext'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { AppLayout } from './components/shared/AppLayout'
import { PortfolioView } from './routes/PortfolioView'
import { SignalDetailView } from './routes/signal/SignalDetailView'
import { PlanView } from './routes/signal/PlanView'
import { SignalsListView } from './routes/SignalsListView'
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
              <Route path="/signals" element={<SignalsListView />} />
              <Route path="/playbook" element={<PlaybookView />} />
              <Route path="/signals/:signalId" element={<SignalDetailView />} />
              <Route path="/signals/:signalId/plan" element={<PlanView />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </AppProvider>
  )
}
