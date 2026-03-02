#!/usr/bin/env python3
"""Bridge script: runs TradingAgents and outputs structured JSON to stdout.

Usage:
    python3 eval/tradingagents/bridge.py --ticker SPY --date 2022-06-15 --model gemini-3-flash-preview

Output (stdout JSON):
    { "signal": "BUY"|"SELL"|"HOLD", "reasoning": "...", "reports": {...} }
    or on failure:
    { "error": "..." }
"""

import argparse
import json
import os
import sys
from datetime import date


def load_env():
    """Load .env file from the project root to get API keys."""
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())
    except FileNotFoundError:
        pass

    # Map GEMINI_API_KEY → GOOGLE_API_KEY (TradingAgents uses langchain-google-genai)
    if not os.environ.get("GOOGLE_API_KEY") and os.environ.get("GEMINI_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]


def build_config(model: str, pkg_path: str) -> dict:
    """Build TradingAgents config for Google Gemini provider."""
    return {
        "llm_provider": "google",
        "deep_think_llm": model,
        "quick_think_llm": model,
        "backend_url": None,
        "max_debate_rounds": 1,
        "max_risk_discuss_rounds": 1,
        "max_recur_limit": 100,
        "data_vendors": {
            "core_stock_apis": "yfinance",
            "technical_indicators": "yfinance",
            "fundamental_data": "yfinance",
            "news_data": "yfinance",
        },
        "tool_vendors": {},
        "project_dir": pkg_path,
        "data_cache_dir": os.path.join(pkg_path, "dataflows/data_cache"),
        "results_dir": "/tmp/tradingagents_results",
    }


def extract_reasoning(final_state: dict) -> str:
    """Extract a comprehensive reasoning summary from the TradingAgents final state."""
    parts = []

    # Final trade decision (most important)
    decision = final_state.get("final_trade_decision", "")
    if decision:
        parts.append(f"## Final Trade Decision\n{decision}")

    # Investment debate summary
    invest_debate = final_state.get("investment_debate_state", {})
    judge_decision = invest_debate.get("judge_decision", "")
    if judge_decision:
        parts.append(f"## Investment Debate Judge Decision\n{judge_decision}")

    # Risk debate summary
    risk_debate = final_state.get("risk_debate_state", {})
    risk_judge = risk_debate.get("judge_decision", "")
    if risk_judge:
        parts.append(f"## Risk Debate Judge Decision\n{risk_judge}")

    # Analyst reports (abbreviated)
    for report_key, label in [
        ("market_report", "Market Analysis"),
        ("sentiment_report", "Sentiment Analysis"),
        ("news_report", "News Analysis"),
        ("fundamentals_report", "Fundamentals Analysis"),
    ]:
        report = final_state.get(report_key, "")
        if report:
            # Truncate very long reports to keep reasoning manageable
            truncated = report[:2000] + ("..." if len(report) > 2000 else "")
            parts.append(f"## {label}\n{truncated}")

    return "\n\n".join(parts) if parts else "No reasoning available"


def extract_reports(final_state: dict) -> dict:
    """Extract structured report data from final state."""
    return {
        "market_report": final_state.get("market_report", ""),
        "sentiment_report": final_state.get("sentiment_report", ""),
        "news_report": final_state.get("news_report", ""),
        "fundamentals_report": final_state.get("fundamentals_report", ""),
        "investment_debate_judge": final_state.get("investment_debate_state", {}).get("judge_decision", ""),
        "risk_debate_judge": final_state.get("risk_debate_state", {}).get("judge_decision", ""),
        "investment_plan": final_state.get("investment_plan", ""),
    }


def main():
    parser = argparse.ArgumentParser(description="TradingAgents bridge for Prism eval")
    parser.add_argument("--ticker", required=True, help="Stock/ETF ticker (e.g., SPY)")
    parser.add_argument("--date", required=True, help="Trade date (YYYY-MM-DD)")
    parser.add_argument("--model", default="gemini-3-flash-preview", help="Gemini model name")
    args = parser.parse_args()

    # Load .env for API keys before any imports that need them
    load_env()

    # Suppress all non-JSON output to stderr
    original_stdout = sys.stdout

    try:
        # Redirect stdout to stderr during execution so TradingAgents' prints
        # don't contaminate our JSON output
        sys.stdout = sys.stderr

        import tradingagents
        from tradingagents.graph import TradingAgentsGraph

        pkg_path = tradingagents.__path__[0]
        config = build_config(args.model, pkg_path)

        ta = TradingAgentsGraph(config=config)
        final_state, signal = ta.propagate(args.ticker, args.date)

        # Clean signal (BUY/SELL/HOLD)
        clean_signal = signal.strip().upper()
        if clean_signal not in ("BUY", "SELL", "HOLD"):
            # Try to extract from longer text
            for keyword in ("BUY", "SELL", "HOLD"):
                if keyword in clean_signal:
                    clean_signal = keyword
                    break
            else:
                clean_signal = "HOLD"  # Default fallback

        result = {
            "signal": clean_signal,
            "reasoning": extract_reasoning(final_state),
            "reports": extract_reports(final_state),
        }

        # Restore stdout and write JSON
        sys.stdout = original_stdout
        print(json.dumps(result))

    except Exception as e:
        sys.stdout = original_stdout
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
