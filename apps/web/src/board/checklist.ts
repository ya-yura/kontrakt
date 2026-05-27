export type ChecklistTemplateItem = {
  id: string;
  label: string;
};

export type ChecklistTemplate = {
  items: ChecklistTemplateItem[];
};

export type ChecklistItemState = {
  checked: boolean;
  updatedAt: string;
};

export type ChecklistState = {
  items: Record<string, ChecklistItemState>;
};

export type ChecklistProgress = {
  checked: number;
  total: number;
  percent: number;
};

export type ChecklistRow = ChecklistTemplateItem & ChecklistItemState;

export const CHECKLIST_ITEM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_CHECKLIST_TEMPLATE_ITEMS = 50;
export const MAX_CHECKLIST_ITEM_LABEL_LENGTH = 160;

const EMPTY_TEMPLATE: ChecklistTemplate = {
  items: []
};

export const DEFAULT_STAGE_CHECKLIST_TEMPLATES = {
  INBOX: {
    items: [
      { id: "inbox-relevance", label: "Проверить релевантность" },
      { id: "inbox-deadline", label: "Проверить дедлайн" },
      { id: "inbox-customer", label: "Проверить заказчика" }
    ]
  },
  QUALIFY: {
    items: [
      { id: "qualify-region", label: "Проверить регион" },
      { id: "qualify-price", label: "Проверить цену" },
      { id: "qualify-security", label: "Проверить обеспечение" },
      { id: "qualify-key-requirements", label: "Проверить ключевые требования" }
    ]
  },
  GO: {
    items: [
      { id: "go-confirm-decision", label: "Подтвердить решение" },
      { id: "go-assign-owner", label: "Назначить ответственного" },
      { id: "go-check-blockers", label: "Проверить blockers" }
    ]
  },
  PREPARE: {
    items: [
      { id: "prepare-documents", label: "Собрать документы" },
      { id: "prepare-application-form", label: "Проверить форму заявки" },
      { id: "prepare-signature-platform", label: "Проверить подпись/ЭТП" }
    ]
  },
  SUBMITTED_EXTERNALLY: {
    items: [
      { id: "submitted-record", label: "Зафиксировать факт подачи" },
      { id: "submitted-number-comment", label: "Сохранить номер/комментарий" }
    ]
  },
  WON: {
    items: [
      { id: "won-result-recorded", label: "Зафиксировать победу" },
      { id: "won-next-step", label: "Проверить следующий шаг" }
    ]
  },
  LOST: {
    items: [
      { id: "lost-reason", label: "Зафиксировать причину проигрыша" },
      { id: "lost-protocol", label: "Сохранить итоговый протокол" }
    ]
  },
  ARCHIVED: {
    items: [
      { id: "archived-reason", label: "Проверить причину архивации" },
      { id: "archived-notes", label: "Закрыть рабочие заметки" }
    ]
  }
} as const satisfies Record<string, ChecklistTemplate>;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function isChecklistItemId(value: string) {
  return value.length <= 80 && CHECKLIST_ITEM_ID_PATTERN.test(value);
}

export function parseChecklistTemplate(value: unknown): ChecklistTemplate {
  if (!isObjectRecord(value) || !Array.isArray(value.items)) {
    return EMPTY_TEMPLATE;
  }

  const seen = new Set<string>();
  const items: ChecklistTemplateItem[] = [];

  for (const item of value.items) {
    if (!isObjectRecord(item) || typeof item.id !== "string" || typeof item.label !== "string") {
      continue;
    }

    const id = item.id.trim();
    const label = item.label.trim();

    if (
      !id ||
      !label ||
      seen.has(id) ||
      !isChecklistItemId(id) ||
      label.length > MAX_CHECKLIST_ITEM_LABEL_LENGTH
    ) {
      continue;
    }

    seen.add(id);
    items.push({ id, label });

    if (items.length >= MAX_CHECKLIST_TEMPLATE_ITEMS) {
      break;
    }
  }

  return {
    items
  };
}

export function parseChecklistState(value: unknown): ChecklistState | null {
  if (!isObjectRecord(value) || !isObjectRecord(value.items)) {
    return null;
  }

  const items: ChecklistState["items"] = {};

  for (const [itemId, itemState] of Object.entries(value.items)) {
    if (!isChecklistItemId(itemId) || !isObjectRecord(itemState)) {
      continue;
    }

    if (typeof itemState.checked !== "boolean" || typeof itemState.updatedAt !== "string") {
      continue;
    }

    if (Number.isNaN(Date.parse(itemState.updatedAt))) {
      continue;
    }

    items[itemId] = {
      checked: itemState.checked,
      updatedAt: itemState.updatedAt
    };
  }

  return {
    items
  };
}

export function createEmptyChecklistState(): ChecklistState {
  return {
    items: {}
  };
}

export function buildChecklistStateForTemplate(
  template: ChecklistTemplate,
  state: ChecklistState | null,
  updatedAt = new Date().toISOString()
): ChecklistState {
  const items: ChecklistState["items"] = {
    ...(state?.items ?? {})
  };

  for (const item of template.items) {
    if (!items[item.id]) {
      items[item.id] = {
        checked: false,
        updatedAt
      };
    }
  }

  return {
    items
  };
}

export function getChecklistRows(
  template: ChecklistTemplate,
  state: ChecklistState | null,
  updatedAt = new Date().toISOString()
): ChecklistRow[] {
  const checklistState = buildChecklistStateForTemplate(template, state, updatedAt);

  return template.items.map((item) => ({
    ...item,
    ...checklistState.items[item.id]
  }));
}

export function calculateChecklistProgress(
  template: ChecklistTemplate,
  state: ChecklistState | null
): ChecklistProgress {
  const total = template.items.length;

  if (total === 0) {
    return {
      checked: 0,
      total,
      percent: 0
    };
  }

  const checked = template.items.filter((item) => state?.items[item.id]?.checked === true).length;

  return {
    checked,
    total,
    percent: Math.round((checked / total) * 100)
  };
}
