import { z, ZodError } from "zod";
import {
  CHECKLIST_ITEM_ID_PATTERN,
  MAX_CHECKLIST_TEMPLATE_ITEMS,
  calculateChecklistProgress,
  type ChecklistProgress,
  type ChecklistState,
  type ChecklistTemplate
} from "./checklist";

export type BoardActionErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "UNKNOWN_ERROR";

export type BoardActionError = {
  code: BoardActionErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: BoardActionError;
    };

export type MoveTenderInput = {
  tenderId: string;
  stageCode: string;
};

export type TenderStageOwnerRecord = {
  id: string;
  ownerId: string | null;
  kanbanStageId: string;
  sourceStage: string;
  checklistState?: ChecklistState | null;
};

export type KanbanStageTargetRecord = {
  id: string;
  ownerId: string;
  code: string;
  name: string;
  checklistTemplate?: ChecklistTemplate;
};

export type MovedTenderRecord = {
  id: string;
  kanbanStageId: string;
  sourceStage: string;
};

export type MoveTenderStageStore = {
  findOwnedTender(tenderId: string, userId: string): Promise<TenderStageOwnerRecord | null>;
  findOwnedStage(stageCode: string, userId: string): Promise<KanbanStageTargetRecord | null>;
  updateTenderStage(tenderId: string, kanbanStageId: string): Promise<MovedTenderRecord>;
};

export type MoveTenderStageData = {
  tenderId: string;
  kanbanStageId: string;
  sourceStage: string;
  stage: KanbanStageTargetRecord;
  checklistProgress: ChecklistProgress;
};

export type UpdateTenderChecklistInput = {
  tenderId: string;
  checklistState: unknown;
};

export type TenderChecklistOwnerRecord = {
  id: string;
  ownerId: string | null;
};

export type UpdatedTenderChecklistRecord = {
  id: string;
  checklistState: ChecklistState;
};

export type UpdateTenderChecklistStore = {
  findOwnedTender(tenderId: string, userId: string): Promise<TenderChecklistOwnerRecord | null>;
  updateTenderChecklist(
    tenderId: string,
    checklistState: ChecklistState
  ): Promise<UpdatedTenderChecklistRecord>;
};

export type UpdateTenderChecklistData = {
  tenderId: string;
  checklistState: ChecklistState;
};

export type UpdateTenderOwnerCommentInput = {
  tenderId: string;
  ownerComment: unknown;
};

export type TenderOwnerCommentOwnerRecord = {
  id: string;
  ownerId: string | null;
};

export type UpdatedTenderOwnerCommentRecord = {
  id: string;
  ownerComment: string | null;
};

export type UpdateTenderOwnerCommentStore = {
  findOwnedTender(tenderId: string, userId: string): Promise<TenderOwnerCommentOwnerRecord | null>;
  updateTenderOwnerComment(
    tenderId: string,
    ownerComment: string | null
  ): Promise<UpdatedTenderOwnerCommentRecord>;
};

export type UpdateTenderOwnerCommentData = {
  tenderId: string;
  ownerComment: string;
};

const MAX_CHECKLIST_STATE_ITEMS = MAX_CHECKLIST_TEMPLATE_ITEMS * 8;
const MAX_OWNER_COMMENT_LENGTH = 4000;

const tenderIdSchema = z.string().trim().min(1, "Tender is required.");

const checklistItemIdSchema = z
  .string()
  .trim()
  .min(1, "Checklist item id is required.")
  .max(80, "Checklist item id is too long.")
  .regex(CHECKLIST_ITEM_ID_PATTERN, "Checklist item id must be stable kebab-case.");

const checklistItemStateSchema = z
  .object({
    checked: z.boolean(),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .strict();

export const checklistStateSchema = z
  .object({
    items: z
      .record(checklistItemIdSchema, checklistItemStateSchema)
      .superRefine((items, context) => {
        if (Object.keys(items).length > MAX_CHECKLIST_STATE_ITEMS) {
          context.addIssue({
            code: "custom",
            message: `Checklist supports up to ${MAX_CHECKLIST_STATE_ITEMS} saved items.`
          });
        }
      })
  })
  .strict();

export const moveTenderInputSchema = z.object({
  tenderId: tenderIdSchema,
  stageCode: z.string().trim().min(1, "Stage is required.").max(80, "Stage code is too long.")
});

export const updateTenderChecklistInputSchema = z
  .object({
    tenderId: tenderIdSchema,
    checklistState: checklistStateSchema
  })
  .strict();

export const updateTenderOwnerCommentInputSchema = z
  .object({
    tenderId: tenderIdSchema,
    ownerComment: z
      .string()
      .trim()
      .max(MAX_OWNER_COMMENT_LENGTH, `Comment must be ${MAX_OWNER_COMMENT_LENGTH} characters or less.`)
  })
  .strict();

export function boardActionFailure(
  code: BoardActionErrorCode,
  message: string
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code,
      message
    }
  };
}

export function boardValidationFailure(
  error: ZodError,
  message = "Проверьте параметры запроса."
): ActionResult<never> {
  const flattened = error.flatten();
  const rawFieldErrors = flattened.fieldErrors as Record<string, string[] | undefined>;
  const fieldErrors = Object.fromEntries(
    Object.entries(rawFieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0
    )
  ) as Record<string, string[]>;

  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message,
      fieldErrors
    }
  };
}

export function boardNotFoundFailure(): ActionResult<never> {
  return boardActionFailure("NOT_FOUND", "Закупка или стадия не найдены.");
}

export async function moveTenderToStageForUser(
  store: MoveTenderStageStore,
  userId: string,
  input: MoveTenderInput
): Promise<ActionResult<MoveTenderStageData>> {
  const parsed = moveTenderInputSchema.safeParse(input);

  if (!parsed.success) {
    return boardValidationFailure(parsed.error, "Проверьте параметры перемещения.");
  }

  const [tender, stage] = await Promise.all([
    store.findOwnedTender(parsed.data.tenderId, userId),
    store.findOwnedStage(parsed.data.stageCode, userId)
  ]);

  if (!tender || !stage) {
    return boardNotFoundFailure();
  }

  const updated = await store.updateTenderStage(tender.id, stage.id);

  return {
    ok: true,
    data: {
      tenderId: updated.id,
      kanbanStageId: updated.kanbanStageId,
      sourceStage: updated.sourceStage,
      stage,
      checklistProgress: calculateChecklistProgress(
        stage.checklistTemplate ?? { items: [] },
        tender.checklistState ?? null
      )
    }
  };
}

export async function updateTenderChecklistForUser(
  store: UpdateTenderChecklistStore,
  userId: string,
  input: UpdateTenderChecklistInput
): Promise<ActionResult<UpdateTenderChecklistData>> {
  const parsed = updateTenderChecklistInputSchema.safeParse(input);

  if (!parsed.success) {
    return boardValidationFailure(parsed.error, "Проверьте checklist.");
  }

  const tender = await store.findOwnedTender(parsed.data.tenderId, userId);

  if (!tender) {
    return boardNotFoundFailure();
  }

  const updated = await store.updateTenderChecklist(tender.id, parsed.data.checklistState);

  return {
    ok: true,
    data: {
      tenderId: updated.id,
      checklistState: updated.checklistState
    }
  };
}

export async function updateTenderOwnerCommentForUser(
  store: UpdateTenderOwnerCommentStore,
  userId: string,
  input: UpdateTenderOwnerCommentInput
): Promise<ActionResult<UpdateTenderOwnerCommentData>> {
  const parsed = updateTenderOwnerCommentInputSchema.safeParse(input);

  if (!parsed.success) {
    return boardValidationFailure(parsed.error, "Проверьте комментарий.");
  }

  const tender = await store.findOwnedTender(parsed.data.tenderId, userId);

  if (!tender) {
    return boardNotFoundFailure();
  }

  const normalizedComment = parsed.data.ownerComment || null;
  const updated = await store.updateTenderOwnerComment(tender.id, normalizedComment);

  return {
    ok: true,
    data: {
      tenderId: updated.id,
      ownerComment: updated.ownerComment ?? ""
    }
  };
}
