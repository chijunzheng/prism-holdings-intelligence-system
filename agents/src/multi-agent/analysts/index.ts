// Analyst Team — 4 parallel analysts with different mandates
// Each produces an AnalystAssessment from a different analytical perspective.

export { runAnalyst, runAllAnalysts } from './run-analyst.js'
export { runMacroAnalyst } from './macro-analyst.js'
export { runFundamentalAnalyst } from './fundamental-analyst.js'
export { runSentimentAnalyst } from './sentiment-analyst.js'
export { runTechnicalAnalyst } from './technical-analyst.js'
export { buildAnalystPrompt, getAnalystMandate } from './shared-prompt.js'
