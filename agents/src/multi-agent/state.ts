// Pipeline State — LangGraph Annotation for the multi-agent analysis pipeline.
// Defines typed state with reducers for array-accumulating fields.
// Non-array fields use last-value semantics (default Annotation behavior).

import { Annotation } from '@langchain/langgraph'
import type {
  Signal,
  Portfolio,
  ExposureMap,
  MarketDataBundle,
  InferredRiskProfile,
  AnalystAssessment,
  DebateResolution,
  RiskChallenge,
  MagnitudeValidation,
  StressTestResult,
  FundManagerVerdict,
  JudgeVerdict,
  ResearchBrief,
  UserExpectations,
  ScenarioPreference,
} from '@prism/shared'
import type { UserProfile } from '@prism/shared'

// ── Pipeline State Annotation ───────────────────────────────
// Fields without reducers use last-value semantics (overwrite on update).
// Fields with reducers accumulate values across nodes.
export const PipelineState = Annotation.Root({
  // ── Inputs (set once at start) ──
  signal: Annotation<Signal>,
  portfolio: Annotation<Portfolio>,
  exposureMap: Annotation<ExposureMap>,
  userProfile: Annotation<UserProfile>,
  userExpectations: Annotation<UserExpectations | undefined>,
  skipCheckpoints: Annotation<boolean>,

  // ── Stage 0: Preparation ──
  riskProfile: Annotation<InferredRiskProfile | null>,
  marketData: Annotation<MarketDataBundle | null>,

  // ── Stage 1: Analyst assessments (accumulated via reducer) ──
  analystAssessments: Annotation<AnalystAssessment[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // ── Stage 2: Debate ──
  debateResolution: Annotation<DebateResolution | null>,

  // ── Human inputs (injected after interrupts) ──
  humanCorrectionAtDebate: Annotation<string | null>,
  humanScenarioPreference: Annotation<ScenarioPreference | null>,

  // ── Stage 3: Risk team ──
  riskChallenge: Annotation<RiskChallenge | null>,
  magnitudeValidation: Annotation<MagnitudeValidation | null>,
  stressTest: Annotation<StressTestResult | null>,

  // ── Stage 4: Synthesis ──
  fundManagerVerdict: Annotation<FundManagerVerdict | null>,
  judgeVerdict: Annotation<JudgeVerdict | null>,
  synthesisRound: Annotation<number>,
  judgeFeedback: Annotation<string | null>,

  // ── Final output ──
  researchBrief: Annotation<ResearchBrief | null>,
})

export type PipelineStateType = typeof PipelineState.State
