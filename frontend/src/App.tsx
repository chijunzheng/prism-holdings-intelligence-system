import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './contexts/AppContext'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { AppShell } from './components/layout/AppShell'
import { ChatView } from './routes/ChatView'

export function App() {
  return (
    <AppProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<ChatView />} />
              <Route path="holdings" element={<Navigate to="/?panel=holdings" replace />} />
              <Route path="signals" element={<Navigate to="/?panel=signals" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </AppProvider>
  )
}
