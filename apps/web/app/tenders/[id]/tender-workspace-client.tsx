"use client";

import { useMemo, useState, useTransition } from "react";
import { updateTenderChecklist, updateTenderOwnerComment } from "./actions";
import {
  buildChecklistStateForTemplate,
  calculateChecklistProgress,
  getChecklistRows,
  type ChecklistState,
  type ChecklistTemplate
} from "@/src/board/checklist";

type TenderWorkspaceClientProps = {
  tenderId: string;
  checklistTemplate: ChecklistTemplate;
  initialChecklistState: ChecklistState;
  initialOwnerComment: string;
};

type Notice = {
  tone: "success" | "error";
  message: string;
};

export function TenderWorkspaceClient({
  tenderId,
  checklistTemplate,
  initialChecklistState,
  initialOwnerComment
}: TenderWorkspaceClientProps) {
  const [checklistState, setChecklistState] = useState(initialChecklistState);
  const [ownerComment, setOwnerComment] = useState(initialOwnerComment);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [commentNotice, setCommentNotice] = useState<Notice | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [isChecklistPending, startChecklistTransition] = useTransition();
  const [isCommentPending, startCommentTransition] = useTransition();
  const checklistRows = useMemo(
    () => getChecklistRows(checklistTemplate, checklistState),
    [checklistState, checklistTemplate]
  );
  const checklistProgress = useMemo(
    () => calculateChecklistProgress(checklistTemplate, checklistState),
    [checklistState, checklistTemplate]
  );

  function handleChecklistChange(itemId: string, checked: boolean) {
    const previousState = checklistState;
    const nextState = buildChecklistStateForTemplate(checklistTemplate, checklistState);
    nextState.items[itemId] = {
      checked,
      updatedAt: new Date().toISOString()
    };

    setChecklistState(nextState);
    setPendingItemId(itemId);
    setNotice(null);

    startChecklistTransition(async () => {
      const result = await updateTenderChecklist(tenderId, nextState);

      if (!result.ok) {
        setChecklistState(previousState);
        setNotice({
          tone: "error",
          message: result.error.message
        });
        setPendingItemId(null);
        return;
      }

      setChecklistState(result.data.checklistState);
      setNotice({
        tone: "success",
        message: "Checklist сохранен."
      });
      setPendingItemId(null);
    });
  }

  function handleCommentSave() {
    setCommentNotice(null);

    startCommentTransition(async () => {
      const result = await updateTenderOwnerComment(tenderId, ownerComment);

      if (!result.ok) {
        setCommentNotice({
          tone: "error",
          message: result.error.message
        });
        return;
      }

      setOwnerComment(result.data.ownerComment);
      setCommentNotice({
        tone: "success",
        message: "Комментарий сохранен."
      });
    });
  }

  return (
    <section className="tender-workspace-grid" aria-label="Operational checklist and owner comment">
      <div className="tender-section tender-checklist-section">
        <div className="section-heading split-heading">
          <div>
            <p className="section-kicker">Checklist</p>
            <h2>Готовность стадии</h2>
          </div>
          <div className="checklist-progress" aria-label="Checklist progress">
            <strong>{checklistProgress.percent}%</strong>
            <span>
              {checklistProgress.checked}/{checklistProgress.total}
            </span>
          </div>
        </div>

        {checklistRows.length === 0 ? (
          <div className="empty-state compact-empty">
            <h3>Checklist не настроен</h3>
            <p>Для текущей стадии нет checklistTemplate.</p>
          </div>
        ) : (
          <ul className="checklist-list">
            {checklistRows.map((item) => {
              const isCurrentItemPending = isChecklistPending && pendingItemId === item.id;

              return (
                <li key={item.id}>
                  <label className="checklist-item">
                    <input
                      checked={item.checked}
                      disabled={isChecklistPending}
                      onChange={(event) => handleChecklistChange(item.id, event.target.checked)}
                      type="checkbox"
                    />
                    <span>{isCurrentItemPending ? `${item.label} - saving` : item.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {notice ? (
          <p className={notice.tone === "success" ? "form-success" : "form-alert"}>
            {notice.message}
          </p>
        ) : null}
      </div>

      <div className="tender-section owner-comment-section">
        <div className="section-heading">
          <p className="section-kicker">Owner comment</p>
          <h2>Комментарий владельца</h2>
        </div>
        <label className="field">
          <span>Комментарий</span>
          <textarea
            maxLength={4000}
            onChange={(event) => setOwnerComment(event.target.value)}
            value={ownerComment}
          />
        </label>
        <div className="form-actions">
          <button
            className="secondary-button"
            disabled={isCommentPending}
            onClick={handleCommentSave}
            type="button"
          >
            {isCommentPending ? "Saving" : "Save comment"}
          </button>
        </div>
        {commentNotice ? (
          <p className={commentNotice.tone === "success" ? "form-success" : "form-alert"}>
            {commentNotice.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
