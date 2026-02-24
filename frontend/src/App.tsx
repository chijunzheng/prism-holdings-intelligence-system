import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PortfolioView } from './routes/PortfolioView'
import { CausalGraphView } from './routes/CausalGraphView'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/portfolio" replace />} />
        <Route path="/portfolio" element={<PortfolioView />} />
        <Route path="/graph/:signalId" element={<CausalGraphView />} />
      </Routes>
    </BrowserRouter>
  )
}
