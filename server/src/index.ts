import express from 'express'
import cors from 'cors'
import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { getPortfolioByUserId, getFundComposition, getUserProfileById } from '@prism/data'
import { analyze } from '@prism/agents/src/exposure-analyzer/index'
import { monitor } from '@prism/agents/src/signal-monitor/index'
import { propagate } from '@prism/agents/src/causal-propagation/index'
import { classify as classifyTemporalReasoning } from '@prism/agents/src/temporal-reasoner/index'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFile(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../.env'),
    resolve(__dirname, '../../.env'),
  ]

  const envPath = candidates.find((path) => existsSync(path))
  if (!envPath) return

  const content = readFileSync(envPath, 'utf-8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const equalsIndex = line.indexOf('=')
    if (equalsIndex <= 0) continue

    const rawKey = line.slice(0, equalsIndex).trim()
    const key = rawKey.startsWith('export ') ? rawKey.slice(7).trim() : rawKey
    if (!key) continue

    let value = line.slice(equalsIndex + 1).trim()
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))

    if (isQuoted) {
      value = value.slice(1, -1)
    } else if (value.includes('#')) {
      // Allow inline comments on unquoted values.
      value = value.split('#', 1)[0].trim()
    }

    // Make .env authoritative for this process to avoid stale shell exports.
    process.env[key] = value
  }
}

loadEnvFile()

if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.GOOGLE_API_KEY
}

const app = express()
const port = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Exposure analysis endpoint
app.get('/api/exposure/:userId', async (req, res) => {
  const portfolio = getPortfolioByUserId(req.params.userId)
  if (!portfolio) {
    res.status(404).json({ success: false, error: 'Portfolio not found' })
    return
  }

  const result = await analyze(portfolio, getFundComposition)
  if (!result.success) {
    res.status(500).json(result)
    return
  }

  res.json(result)
})

// Live signal endpoint
app.get('/api/signals/:userId', async (req, res) => {
  const portfolio = getPortfolioByUserId(req.params.userId)
  if (!portfolio) {
    res.status(404).json({ success: false, error: 'Portfolio not found' })
    return
  }

  const exposureResult = await analyze(portfolio, getFundComposition)
  if (!exposureResult.success || !exposureResult.data) {
    res.status(500).json({
      success: false,
      error: exposureResult.error ?? 'Failed to analyze exposures',
    })
    return
  }

  const signalResult = await monitor(exposureResult.data)
  if (!signalResult.success) {
    res.status(500).json({
      success: false,
      error: signalResult.error ?? 'Failed to monitor signals',
    })
    return
  }

  res.json(signalResult)
})

// Causal graph data endpoint (signal + chain + temporal analysis)
app.get('/api/graph/:userId/:signalId', async (req, res) => {
  const { userId } = req.params
  const signalId = decodeURIComponent(req.params.signalId)

  const portfolio = getPortfolioByUserId(userId)
  if (!portfolio) {
    res.status(404).json({ success: false, error: 'Portfolio not found' })
    return
  }

  const profile = getUserProfileById(userId)
  if (!profile) {
    res.status(404).json({ success: false, error: 'User profile not found' })
    return
  }

  const exposureResult = await analyze(portfolio, getFundComposition)
  if (!exposureResult.success || !exposureResult.data) {
    res.status(500).json({
      success: false,
      error: exposureResult.error ?? 'Failed to analyze exposures',
    })
    return
  }

  const signalResult = await monitor(exposureResult.data)
  if (!signalResult.success || !signalResult.data) {
    res.status(500).json({
      success: false,
      error: signalResult.error ?? 'Failed to monitor signals',
    })
    return
  }

  const signal = signalResult.data.find((item) => item.id === signalId)
  if (!signal) {
    res.status(404).json({ success: false, error: 'Signal not found' })
    return
  }

  const chainResult = await propagate(signal, exposureResult.data)
  if (!chainResult.success || !chainResult.data) {
    res.status(500).json({
      success: false,
      error: chainResult.error ?? 'Failed to generate causal chain',
    })
    return
  }

  const temporalResult = await classifyTemporalReasoning(chainResult.data, profile)
  if (!temporalResult.success || !temporalResult.data) {
    res.status(500).json({
      success: false,
      error: temporalResult.error ?? 'Failed to generate temporal analysis',
    })
    return
  }

  res.json({
    success: true,
    data: {
      signal,
      chain: chainResult.data,
      temporalAnalysis: temporalResult.data,
    },
  })
})

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Prism server running on http://localhost:${port}`)
})
