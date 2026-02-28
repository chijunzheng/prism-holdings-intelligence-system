// 25 curated historical events with ground-truth 5-day returns.
// Returns are approximate cumulative 5-trading-day returns from Yahoo Finance.
// Sources: Federal Reserve, Bank of Canada, Statistics Canada, EIA, Reuters.

import type { HistoricalEvent } from '../types'

export const HISTORICAL_EVENTS: readonly HistoricalEvent[] = [
  // ── Rate Decisions (8) ──────────────────────────────────────
  {
    id: 'fed-75bps-2022-06',
    type: 'rate_decision',
    date: '2022-06-15',
    description: 'FOMC raises rates by 75bps — largest hike since 1994. Markets had partially priced in after hot CPI report.',
    sourceUrl: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20220615a.htm',
    actualReturns5d: {
      VFV: -0.058, XIC: -0.042, ZAG: -0.015, ZEB: -0.035, XEG: -0.095, XGD: -0.012,
    },
  },
  {
    id: 'fed-75bps-2022-09',
    type: 'rate_decision',
    date: '2022-09-21',
    description: 'FOMC raises rates by 75bps for the third consecutive meeting. Dot plot signals higher terminal rate than expected.',
    sourceUrl: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20220921a.htm',
    actualReturns5d: {
      VFV: -0.041, XIC: -0.032, ZAG: -0.012, ZEB: -0.028, XEG: -0.065, XGD: -0.035,
    },
  },
  {
    id: 'fed-pause-2023-06',
    type: 'rate_decision',
    date: '2023-06-14',
    description: 'FOMC pauses rate hikes at 5.00-5.25% after 10 consecutive increases. Signals one more hike later in 2023.',
    sourceUrl: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20230614a.htm',
    actualReturns5d: {
      VFV: 0.022, XIC: 0.015, ZAG: 0.003, ZEB: 0.012, XEG: 0.028, XGD: -0.008,
    },
  },
  {
    id: 'fed-cut-50bps-2024-09',
    type: 'rate_decision',
    date: '2024-09-18',
    description: 'FOMC cuts rates by 50bps to 4.75-5.00% — first cut since March 2020. Larger than the 25bps most expected.',
    sourceUrl: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20240918a.htm',
    actualReturns5d: {
      VFV: 0.018, XIC: 0.021, ZAG: 0.008, ZEB: 0.025, XEG: 0.015, XGD: 0.032,
    },
  },
  {
    id: 'boc-100bps-2022-07',
    type: 'rate_decision',
    date: '2022-07-13',
    description: 'Bank of Canada shocks markets with 100bps hike to 2.5% — largest single increase in BOC history.',
    sourceUrl: 'https://www.bankofcanada.ca/2022/07/fad-press-release-2022-07-13/',
    actualReturns5d: {
      VFV: 0.012, XIC: -0.018, ZAG: -0.008, ZEB: -0.022, XEG: -0.035, XGD: -0.015,
    },
  },
  {
    id: 'boc-pause-2023-01',
    type: 'rate_decision',
    date: '2023-01-25',
    description: 'Bank of Canada pauses rate hikes at 4.5% — first G7 central bank to pause. Signals conditional hold.',
    sourceUrl: 'https://www.bankofcanada.ca/2023/01/fad-press-release-2023-01-25/',
    actualReturns5d: {
      VFV: 0.015, XIC: 0.022, ZAG: 0.005, ZEB: 0.018, XEG: 0.012, XGD: 0.008,
    },
  },
  {
    id: 'boc-surprise-hike-2023-06',
    type: 'rate_decision',
    date: '2023-06-07',
    description: 'Bank of Canada surprises with 25bps hike to 4.75% after holding for 4 months. Persistent inflation blamed.',
    sourceUrl: 'https://www.bankofcanada.ca/2023/06/fad-press-release-2023-06-07/',
    actualReturns5d: {
      VFV: 0.008, XIC: -0.012, ZAG: -0.006, ZEB: -0.015, XEG: -0.008, XGD: -0.018,
    },
  },
  {
    id: 'fed-hold-hawkish-2024-01',
    type: 'rate_decision',
    date: '2024-01-31',
    description: 'FOMC holds rates, removes easing bias from statement. Powell pushes back on March cut expectations.',
    sourceUrl: 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20240131a.htm',
    actualReturns5d: {
      VFV: 0.012, XIC: 0.008, ZAG: -0.004, ZEB: 0.006, XEG: 0.015, XGD: -0.022,
    },
  },

  // ── CPI Surprises (4) ──────────────────────────────────────
  {
    id: 'us-cpi-hot-2022-06',
    type: 'cpi_surprise',
    date: '2022-06-10',
    description: 'US CPI hits 8.6% YoY — highest since 1981. Exceeded 8.3% consensus. Triggered emergency 75bps hike expectation.',
    sourceUrl: 'https://www.bls.gov/news.release/archives/cpi_06102022.htm',
    actualReturns5d: {
      VFV: -0.072, XIC: -0.048, ZAG: -0.018, ZEB: -0.038, XEG: -0.082, XGD: -0.025,
    },
  },
  {
    id: 'us-cpi-cooling-2022-11',
    type: 'cpi_surprise',
    date: '2022-11-10',
    description: 'US CPI comes in at 7.7% vs 7.9% expected — first major downside surprise. Markets rally on pivot hopes.',
    sourceUrl: 'https://www.bls.gov/news.release/archives/cpi_11102022.htm',
    actualReturns5d: {
      VFV: 0.035, XIC: 0.028, ZAG: 0.012, ZEB: 0.025, XEG: 0.018, XGD: 0.042,
    },
  },
  {
    id: 'canada-cpi-drop-2023-06',
    type: 'cpi_surprise',
    date: '2023-06-27',
    description: 'Canada CPI drops to 3.4% from 4.4% — faster decline than expected. Market prices in BOC pause.',
    sourceUrl: 'https://www150.statcan.gc.ca/n1/daily-quotidien/230627/dq230627a-eng.htm',
    actualReturns5d: {
      VFV: 0.008, XIC: 0.018, ZAG: 0.006, ZEB: 0.015, XEG: 0.005, XGD: 0.012,
    },
  },
  {
    id: 'us-cpi-sticky-2024-01',
    type: 'cpi_surprise',
    date: '2024-01-11',
    description: 'US CPI 3.4% vs 3.2% expected — inflation stickier than hoped. Delays rate cut timeline expectations.',
    sourceUrl: 'https://www.bls.gov/news.release/archives/cpi_01112024.htm',
    actualReturns5d: {
      VFV: 0.005, XIC: 0.002, ZAG: -0.008, ZEB: -0.005, XEG: 0.012, XGD: -0.018,
    },
  },

  // ── Oil / Commodity Shocks (4) ─────────────────────────────
  {
    id: 'opec-cut-2022-10',
    type: 'oil_shock',
    date: '2022-10-05',
    description: 'OPEC+ announces 2M bpd production cut — largest since 2020. Oil jumps 8% in two days.',
    sourceUrl: 'https://www.reuters.com/business/energy/opec-agrees-biggest-output-cut-since-2020-2022-10-05/',
    actualReturns5d: {
      VFV: -0.015, XIC: 0.008, ZAG: -0.003, ZEB: -0.005, XEG: 0.065, XGD: -0.008,
    },
  },
  {
    id: 'oil-price-collapse-2023-03',
    type: 'oil_shock',
    date: '2023-03-15',
    description: 'WTI crude falls below $66 — lowest since Dec 2021 — on SVB-driven recession fears and demand concerns.',
    sourceUrl: 'https://www.reuters.com/business/energy/oil-prices-fall-banking-crisis-demand-worries-2023-03-15/',
    actualReturns5d: {
      VFV: 0.018, XIC: -0.008, ZAG: 0.012, ZEB: -0.025, XEG: -0.075, XGD: 0.035,
    },
  },
  {
    id: 'opec-voluntary-cut-2023-11',
    type: 'oil_shock',
    date: '2023-11-30',
    description: 'OPEC+ announces voluntary cuts of 2.2M bpd for Q1 2024. Market disappointed by voluntary nature — oil falls.',
    sourceUrl: 'https://www.reuters.com/business/energy/opec-agrees-fresh-output-cuts-around-2-mln-bpd-2023-11-30/',
    actualReturns5d: {
      VFV: 0.012, XIC: 0.005, ZAG: 0.008, ZEB: 0.008, XEG: -0.032, XGD: 0.005,
    },
  },
  {
    id: 'oil-mideast-spike-2024-04',
    type: 'oil_shock',
    date: '2024-04-12',
    description: 'Iran launches drone/missile attack on Israel. Oil spikes to $92 on Middle East escalation fears.',
    sourceUrl: 'https://www.reuters.com/world/middle-east/iran-launches-drones-toward-israel-us-official-says-2024-04-13/',
    actualReturns5d: {
      VFV: -0.025, XIC: -0.012, ZAG: -0.005, ZEB: -0.008, XEG: 0.035, XGD: 0.042,
    },
  },

  // ── Banking Stress (3) ─────────────────────────────────────
  {
    id: 'svb-collapse-2023-03',
    type: 'banking_stress',
    date: '2023-03-10',
    description: 'Silicon Valley Bank collapses — 2nd largest US bank failure in history. Contagion fears hit global banks.',
    sourceUrl: 'https://www.reuters.com/business/finance/svb-financial-announces-capital-raise-after-portfolio-loss-2023-03-08/',
    actualReturns5d: {
      VFV: -0.028, XIC: -0.032, ZAG: 0.015, ZEB: -0.065, XEG: -0.045, XGD: 0.055,
    },
  },
  {
    id: 'credit-suisse-2023-03',
    type: 'banking_stress',
    date: '2023-03-15',
    description: 'Credit Suisse shares plunge 30% after Saudi backer rules out further investment. Emergency SNB lending follows.',
    sourceUrl: 'https://www.reuters.com/business/finance/credit-suisse-shares-plunge-after-top-investor-rules-out-more-money-2023-03-15/',
    actualReturns5d: {
      VFV: 0.008, XIC: -0.012, ZAG: 0.010, ZEB: -0.042, XEG: -0.025, XGD: 0.038,
    },
  },
  {
    id: 'first-republic-2023-05',
    type: 'banking_stress',
    date: '2023-05-01',
    description: 'First Republic Bank seized by FDIC and sold to JPMorgan Chase. Third major US bank failure in 2 months.',
    sourceUrl: 'https://www.reuters.com/business/finance/first-republic-seized-by-california-regulator-fdic-2023-05-01/',
    actualReturns5d: {
      VFV: -0.005, XIC: -0.008, ZAG: 0.005, ZEB: -0.018, XEG: -0.022, XGD: 0.015,
    },
  },

  // ── Geopolitical (3) ───────────────────────────────────────
  {
    id: 'china-balloon-2023-02',
    type: 'geopolitical',
    date: '2023-02-02',
    description: 'Chinese surveillance balloon spotted over US. Blinken cancels Beijing trip. US-China tensions spike.',
    sourceUrl: 'https://www.reuters.com/world/us-tracking-suspected-chinese-spy-balloon-over-us-officials-2023-02-02/',
    actualReturns5d: {
      VFV: -0.012, XIC: -0.005, ZAG: 0.002, ZEB: -0.003, XEG: 0.008, XGD: 0.012,
    },
  },
  {
    id: 'us-china-chips-2022-10',
    type: 'geopolitical',
    date: '2022-10-07',
    description: 'US imposes sweeping chip export controls on China — broadest tech restrictions in decades.',
    sourceUrl: 'https://www.reuters.com/technology/us-publish-sweeping-rules-curbing-ai-chip-exports-china-2022-10-07/',
    actualReturns5d: {
      VFV: -0.032, XIC: -0.018, ZAG: -0.005, ZEB: -0.008, XEG: -0.015, XGD: 0.005,
    },
  },
  {
    id: 'us-tariff-escalation-2024-05',
    type: 'geopolitical',
    date: '2024-05-14',
    description: 'Biden announces sharp tariff increases on Chinese EVs (100%), semiconductors (50%), steel, aluminum, solar cells.',
    sourceUrl: 'https://www.reuters.com/world/us/biden-hike-tariffs-chinese-evs-chips-other-imports-source-2024-05-14/',
    actualReturns5d: {
      VFV: 0.008, XIC: 0.005, ZAG: 0.002, ZEB: 0.003, XEG: 0.005, XGD: -0.005,
    },
  },

  // ── Currency / FX (3) ──────────────────────────────────────
  {
    id: 'dxy-peak-2022-09',
    type: 'currency_fx',
    date: '2022-09-26',
    description: 'US Dollar Index (DXY) hits 20-year high of 114.8. GBP flash crashes to 1.035. CAD weakens to 1.38.',
    sourceUrl: 'https://www.reuters.com/markets/currencies/dollar-sterling-sinks-record-low-after-uk-tax-cut-plan-2022-09-26/',
    actualReturns5d: {
      VFV: -0.025, XIC: -0.015, ZAG: -0.008, ZEB: -0.012, XEG: -0.035, XGD: -0.045,
    },
  },
  {
    id: 'yen-intervention-2022-10',
    type: 'currency_fx',
    date: '2022-10-21',
    description: 'Japan intervenes in FX markets as yen breaches 150/USD — largest intervention since 1998 ($37B spent).',
    sourceUrl: 'https://www.reuters.com/markets/currencies/yen-breaches-150-per-dollar-first-time-since-1990-2022-10-21/',
    actualReturns5d: {
      VFV: 0.025, XIC: 0.018, ZAG: 0.005, ZEB: 0.012, XEG: 0.022, XGD: 0.015,
    },
  },
  {
    id: 'cad-slide-2024-06',
    type: 'currency_fx',
    date: '2024-06-05',
    description: 'BOC cuts to 4.75% while Fed holds — rate differential widens. CAD drops to weakest in 6 months at 1.375.',
    sourceUrl: 'https://www.bankofcanada.ca/2024/06/fad-press-release-2024-06-05/',
    actualReturns5d: {
      VFV: 0.015, XIC: -0.005, ZAG: 0.003, ZEB: -0.008, XEG: -0.012, XGD: 0.008,
    },
  },
]
