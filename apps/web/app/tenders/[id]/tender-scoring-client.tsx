"use client";

import { useState, useTransition } from "react";
import { rescoreTender, setTenderDecision } from "./actions";
import type {
  TenderDecisionValue,
  TenderScoreMutationData
} from "@/src/lib/scoring/bidNoBid";

type ScoringBreakdownItem = {
  key: "fit" | "economics" | "execution" | "compliance" | "urgency";
  label: string;
  score: number | null;
  max: number;
};

export type TenderScoringView = {
  decision: TenderDecisionValue;
  decisionReason: string;
  scoreTotal: number | null;
  scoreConfidence: number | null;
  lastScoredAt: string | null;
  breakdown: ScoringBreakdownItem[];
};

type Notice = {
  tone: "success" | "error";
  message: string;
};

type TenderScoringClientProps = {
  tenderId: string;
  initialScoring: TenderScoringView;
};

const decisionLabels: Record<TenderDecisionValue, string> = {
  UNDECIDED: "Undecided",
  REVIEW: "Review",
  BID: "Bid",
  NO_BID: "No-bid"
};

const manualDecisionOptions: Array<{ value: TenderDecisionValue; label: string }> = [
  { value: "REVIEW", label: "Review" },
  { value: "BID", label: "Bid" },
  { value: "NO_BID", label: "No-bid" },
  { value: "UNDECIDED", label: "Undecided" }
];

export function TenderScoringClient({ tenderId, initialScoring }: TenderScoringClientProps) {
  const [scoring, setScoring] = useState(initialScoring);
  const [manualDecision, setManualDecision] = useState<TenderDecisionValue>(
    initialScoring.decision === "UNDECIDED" ? "REVIEW" : initialScoring.decision
  );
  const [manualReason, setManualReason] = useState(initialScoring.decisionReason);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isRescorePending, startRescoreTransition] = useTransition();
  const [isOverridePending, startOverrideTransition] = useTransition();

  function handleRescore() {
    setNotice(null);

    startRescoreTransition(async () => {
      const result = await rescoreTender(tenderId);

      if (!result.ok) {
        setNotice({
          tone: "error",
          message: result.error.message
        });
        return;
      }

      const nextScoring = scoringFromResult(result.data);
      setScoring(nextScoring);
      setManualDecision(nextScoring.decision);
      setManualReason(nextScoring.decisionReason);
      setNotice({
        tone: "success",
        message: "Score пересчитан."
      });
    });
  }

  function handleManualOverride() {
    setNotice(null);

    startOverrideTransition(async () => {
      const result = await setTenderDecision(tenderId, manualDecision, manualReason);

      if (!result.ok) {
        setNotice({
          tone: "error",
          message: result.error.message
        });
        return;
      }

      setScoring((current) => ({
        ...current,
        decision: result.data.decision,
        decisionReason: result.data.decisionReason
      }));
      setManualReason(result.data.decisionReason);
      setNotice({
        tone: "success",
        message: "Manual decision сохранен."
      });
    });
  }

  return (
    <section className="tender-scoring-panel" aria-labelledby="scoring-heading">
      <div className="section-heading split-heading">
        <div>
          <p className="section-kicker">Scoring v1</p>
          <h2 id="scoring-heading">Bid / no-bid</h2>
        </div>
        <div className="score-total-chip" aria-label="Total score">
          <span>scoreTotal</span>
          <strong>{scoring.scoreTotal == null ? "—" : scoring.scoreTotal}</strong>
        </div>
      </div>

      <div className="scoring-layout">
        <div className="score-breakdown-card">
          <div className="score-meta-row">
            <span className="badge badge-decision">
              {decisionLabels[scoring.decision] ?? scoring.decision}
            </span>
            <span className="score-confidence">
              confidence {scoring.scoreConfidence == null ? "—" : scoring.scoreConfidence}
            </span>
          </div>

          <ul className="score-breakdown-list" aria-label="Score breakdown">
            {scoring.breakdown.map((item) => {
              const score = item.score ?? 0;
              const percent = Math.max(0, Math.min(100, (score / item.max) * 100));

              return (
                <li key={item.key}>
                  <div>
                    <span>{item.label}</span>
                    <strong>
                      {item.score == null ? "—" : item.score}/{item.max}
                    </strong>
                  </div>
                  <div className="score-track" aria-hidden="true">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="decision-reason">
            <span>decisionReason</span>
            <p>{scoring.decisionReason || "Решение еще не объяснено. Запустите rescore или сохраните manual override."}</p>
          </div>

          <div className="score-actions">
            <button
              className="secondary-button"
              disabled={isRescorePending}
              onClick={handleRescore}
              type="button"
            >
              {isRescorePending ? "Rescoring" : "Rescore"}
            </button>
            <span>{scoring.lastScoredAt ? formatDateTime(scoring.lastScoredAt) : "lastScoredAt: —"}</span>
          </div>
        </div>

        <div className="manual-decision-form">
          <div className="section-heading">
            <p className="section-kicker">Manual override</p>
            <h3>Решение владельца</h3>
          </div>
          <label className="field">
            <span>Decision</span>
            <select
              disabled={isOverridePending}
              onChange={(event) => setManualDecision(event.target.value as TenderDecisionValue)}
              value={manualDecision}
            >
              {manualDecisionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Reason</span>
            <textarea
              disabled={isOverridePending}
              maxLength={1000}
              onChange={(event) => setManualReason(event.target.value)}
              value={manualReason}
            />
          </label>
          <div className="form-actions">
            <button
              className="primary-button"
              disabled={isOverridePending || manualReason.trim().length < 3}
              onClick={handleManualOverride}
              type="button"
            >
              {isOverridePending ? "Saving" : "Save override"}
            </button>
          </div>
        </div>
      </div>

      {notice ? (
        <p className={notice.tone === "success" ? "form-success" : "form-alert"}>
          {notice.message}
        </p>
      ) : null}
    </section>
  );
}

function scoringFromResult(result: TenderScoreMutationData): TenderScoringView {
  return {
    decision: result.decision,
    decisionReason: result.decisionReason,
    scoreTotal: result.scoreTotal,
    scoreConfidence: result.scoreConfidence,
    lastScoredAt: result.lastScoredAt,
    breakdown: [
      { key: "fit", label: "Fit", score: result.scoreFit, max: 30 },
      { key: "economics", label: "Economics", score: result.scoreEconomics, max: 20 },
      { key: "execution", label: "Execution", score: result.scoreExecutionRisk, max: 20 },
      { key: "compliance", label: "Compliance", score: result.scoreComplianceRisk, max: 20 },
      { key: "urgency", label: "Urgency", score: result.scoreUrgency, max: 10 }
    ]
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "lastScoredAt: —";
  }

  return `lastScoredAt: ${new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date)}`;
}
