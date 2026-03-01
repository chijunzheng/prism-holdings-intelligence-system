// CLI runner for the evaluation harness.
// Usage: npx tsx eval/run.ts

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env before any agent imports
function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env')
  try {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx < 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim()
      process.env[key] = value
    }
  } catch {
    console.error('Warning: could not load .env file')
  }

  if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.GOOGLE_API_KEY
  }
}

loadEnv()

async function run(): Promise<void> {
  const { main } = await import('./harness')
  await main()
}

run().catch((error) => {
  console.error('Evaluation failed:', error)
  process.exit(1)
})
