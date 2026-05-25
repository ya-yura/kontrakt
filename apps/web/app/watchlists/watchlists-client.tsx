"use client";

import { useMemo, useState, useTransition } from "react";
import type { ActionError, SavedFilterView } from "@/src/saved-filters/service";
import type { SavedFilterInput, UpdateSavedFilterInput } from "@/src/saved-filters/schemas";
import { createSavedFilter, deleteSavedFilter, updateSavedFilter } from "./actions";

type WatchlistsClientProps = {
  currentUserEmail: string;
  initialFilters: SavedFilterView[];
};

type WatchlistFormDraft = {
  name: string;
  searchQuery: string;
  includeKeywords: string;
  excludeKeywords: string;
  okpd2Prefixes: string;
  regionCodes: string;
  methodAllowList: string;
  customerInnAllowList: string;
  customerInnBlockList: string;
  minPrice: string;
  maxPrice: string;
  daysAhead: string;
  onlyWithSecurity: boolean;
  onlyForMsp: boolean;
  notifyOnNew: boolean;
  notifyOnChanges: boolean;
};

type TextareaField =
  | "includeKeywords"
  | "excludeKeywords"
  | "okpd2Prefixes"
  | "regionCodes"
  | "methodAllowList"
  | "customerInnAllowList"
  | "customerInnBlockList";

type CheckboxField =
  | "onlyWithSecurity"
  | "onlyForMsp"
  | "notifyOnNew"
  | "notifyOnChanges";

const EMPTY_FORM: WatchlistFormDraft = {
  name: "",
  searchQuery: "",
  includeKeywords: "",
  excludeKeywords: "",
  okpd2Prefixes: "",
  regionCodes: "",
  methodAllowList: "",
  customerInnAllowList: "",
  customerInnBlockList: "",
  minPrice: "",
  maxPrice: "",
  daysAhead: "",
  onlyWithSecurity: false,
  onlyForMsp: false,
  notifyOnNew: true,
  notifyOnChanges: false
};

const TEXTAREA_FIELDS: Array<{ name: TextareaField; label: string }> = [
  { name: "includeKeywords", label: "Include keywords" },
  { name: "excludeKeywords", label: "Exclude keywords" },
  { name: "okpd2Prefixes", label: "OKPD2 prefixes" },
  { name: "regionCodes", label: "Region codes" },
  { name: "methodAllowList", label: "Methods allow-list" },
  { name: "customerInnAllowList", label: "Customer INN allow-list" },
  { name: "customerInnBlockList", label: "Customer INN block-list" }
];

const CHECKBOX_FIELDS: Array<{ name: CheckboxField; label: string }> = [
  { name: "onlyWithSecurity", label: "Only with security" },
  { name: "onlyForMsp", label: "Only for MSP" },
  { name: "notifyOnNew", label: "Notify on new" },
  { name: "notifyOnChanges", label: "Notify on changes" }
];

function joinList(items: string[]) {
  return items.join("\n");
}

function moneyToInput(value: number | null) {
  return value == null ? "" : String(value);
}

function formFromFilter(filter: SavedFilterView): WatchlistFormDraft {
  return {
    name: filter.name,
    searchQuery: filter.query.searchQuery,
    includeKeywords: joinList(filter.query.includeKeywords),
    excludeKeywords: joinList(filter.query.excludeKeywords),
    okpd2Prefixes: joinList(filter.query.okpd2Prefixes),
    regionCodes: joinList(filter.query.regionCodes),
    methodAllowList: joinList(filter.query.methodAllowList),
    customerInnAllowList: joinList(filter.query.customerInnAllowList),
    customerInnBlockList: joinList(filter.query.customerInnBlockList),
    minPrice: moneyToInput(filter.query.minPrice),
    maxPrice: moneyToInput(filter.query.maxPrice),
    daysAhead: moneyToInput(filter.query.daysAhead),
    onlyWithSecurity: filter.query.onlyWithSecurity,
    onlyForMsp: filter.query.onlyForMsp,
    notifyOnNew: filter.query.notifyOnNew,
    notifyOnChanges: filter.query.notifyOnChanges
  };
}

function toCreateInput(form: WatchlistFormDraft): SavedFilterInput {
  return {
    ...form
  };
}

function toUpdateInput(filterId: string, form: WatchlistFormDraft): UpdateSavedFilterInput {
  return {
    filterId,
    ...form
  };
}

function upsertFilter(filters: SavedFilterView[], filter: SavedFilterView) {
  const next = filters.filter((item) => item.id !== filter.id);
  next.unshift(filter);
  return next;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatPriceRange(minPrice: number | null, maxPrice: number | null) {
  if (minPrice != null && maxPrice != null) {
    return `${minPrice.toLocaleString("ru-RU")} - ${maxPrice.toLocaleString("ru-RU")} RUB`;
  }

  if (minPrice != null) {
    return `from ${minPrice.toLocaleString("ru-RU")} RUB`;
  }

  if (maxPrice != null) {
    return `to ${maxPrice.toLocaleString("ru-RU")} RUB`;
  }

  return null;
}

function listSummary(label: string, values: string[]) {
  if (!values.length) {
    return null;
  }

  return `${label}: ${values.slice(0, 4).join(", ")}${values.length > 4 ? " ..." : ""}`;
}

function buildFilterSummary(filter: SavedFilterView) {
  const query = filter.query;
  const summary = [
    query.searchQuery ? `Search: ${query.searchQuery}` : null,
    listSummary("Include", query.includeKeywords),
    listSummary("Exclude", query.excludeKeywords),
    listSummary("OKPD2", query.okpd2Prefixes),
    listSummary("Regions", query.regionCodes),
    listSummary("Methods", query.methodAllowList),
    listSummary("INN allow", query.customerInnAllowList),
    listSummary("INN block", query.customerInnBlockList),
    formatPriceRange(query.minPrice, query.maxPrice),
    query.daysAhead != null ? `${query.daysAhead} days ahead` : null,
    query.onlyWithSecurity ? "Security required" : null,
    query.onlyForMsp ? "MSP only" : null,
    query.notifyOnNew ? "Notify: new tenders" : null,
    query.notifyOnChanges ? "Notify: changes" : null
  ].filter((item): item is string => Boolean(item));

  return summary.length ? summary : ["No criteria"];
}

export function WatchlistsClient({ currentUserEmail, initialFilters }: WatchlistsClientProps) {
  const [filters, setFilters] = useState(initialFilters);
  const [form, setForm] = useState<WatchlistFormDraft>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const editingFilter = useMemo(
    () => filters.find((filter) => filter.id === editingId) ?? null,
    [editingId, filters]
  );

  const fieldErrors = actionError?.fieldErrors ?? {};

  function setField<Field extends keyof WatchlistFormDraft>(
    field: Field,
    value: WatchlistFormDraft[Field]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setActionError(null);
  }

  function startEditing(filter: SavedFilterView) {
    setEditingId(filter.id);
    setForm(formFromFilter(filter));
    setActionError(null);
    setNotice(null);
  }

  function handleSubmit() {
    setActionError(null);
    setNotice(null);

    startTransition(async () => {
      const result = editingId
        ? await updateSavedFilter(toUpdateInput(editingId, form))
        : await createSavedFilter(toCreateInput(form));

      if (!result.ok) {
        setActionError(result.error);
        return;
      }

      setFilters((current) => upsertFilter(current, result.data.filter));
      setNotice(editingId ? "Фильтр обновлен." : "Фильтр создан.");
      resetForm();
    });
  }

  function handleDelete(filter: SavedFilterView) {
    setActionError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await deleteSavedFilter(filter.id);

      if (!result.ok) {
        setActionError(result.error);
        return;
      }

      setFilters((current) => current.filter((item) => item.id !== result.data.filterId));

      if (editingId === result.data.filterId) {
        resetForm();
      }

      setNotice("Фильтр удален.");
    });
  }

  function renderError(field: keyof WatchlistFormDraft | "filterId") {
    const messages = fieldErrors[field];

    if (!messages?.length) {
      return null;
    }

    return <p className="field-error">{messages.join(" ")}</p>;
  }

  return (
    <section className="watchlists-layout" aria-label="Saved filters">
      <div className="watchlists-panel">
        <div className="section-heading split-heading">
          <div>
            <p className="section-kicker">Current user</p>
            <h2>{currentUserEmail}</h2>
          </div>
          <span className="count-pill">{filters.length}</span>
        </div>

        {filters.length === 0 ? (
          <div className="empty-state">
            <h3>Нет сохраненных фильтров</h3>
            <p>Создайте первый watchlist для повторяемых условий отбора закупок.</p>
          </div>
        ) : (
          <ul className="filter-list" aria-label="Saved filters list">
            {filters.map((filter) => (
              <li className="filter-card" key={filter.id}>
                <div className="filter-card-header">
                  <div>
                    <h3>{filter.name}</h3>
                    <time dateTime={filter.updatedAt}>Updated {formatDate(filter.updatedAt)}</time>
                  </div>
                  <div className="filter-actions">
                    <button
                      className="secondary-button"
                      disabled={isPending}
                      onClick={() => startEditing(filter)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="danger-button"
                      disabled={isPending}
                      onClick={() => handleDelete(filter)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <ul className="criteria-list">
                  {buildFilterSummary(filter).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        className="watchlist-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <div className="section-heading">
          <p className="section-kicker">{editingFilter ? "Edit SavedFilter" : "New SavedFilter"}</p>
          <h2>{editingFilter ? editingFilter.name : "Create watchlist"}</h2>
        </div>

        {actionError ? (
          <div className="form-alert" role="alert">
            {actionError.message}
            {renderError("filterId")}
          </div>
        ) : null}

        {notice ? <div className="form-success">{notice}</div> : null}

        <label className="field">
          <span>Name</span>
          <input
            autoComplete="off"
            disabled={isPending}
            onChange={(event) => setField("name", event.target.value)}
            type="text"
            value={form.name}
          />
          {renderError("name")}
        </label>

        <label className="field">
          <span>Search query</span>
          <input
            autoComplete="off"
            disabled={isPending}
            onChange={(event) => setField("searchQuery", event.target.value)}
            type="text"
            value={form.searchQuery}
          />
          {renderError("searchQuery")}
        </label>

        <div className="form-grid two-columns">
          <label className="field">
            <span>Min price</span>
            <input
              disabled={isPending}
              inputMode="decimal"
              onChange={(event) => setField("minPrice", event.target.value)}
              type="text"
              value={form.minPrice}
            />
            {renderError("minPrice")}
          </label>
          <label className="field">
            <span>Max price</span>
            <input
              disabled={isPending}
              inputMode="decimal"
              onChange={(event) => setField("maxPrice", event.target.value)}
              type="text"
              value={form.maxPrice}
            />
            {renderError("maxPrice")}
          </label>
          <label className="field">
            <span>Days ahead</span>
            <input
              disabled={isPending}
              inputMode="numeric"
              onChange={(event) => setField("daysAhead", event.target.value)}
              type="text"
              value={form.daysAhead}
            />
            {renderError("daysAhead")}
          </label>
        </div>

        <div className="form-grid">
          {TEXTAREA_FIELDS.map((field) => (
            <label className="field" key={field.name}>
              <span>{field.label}</span>
              <textarea
                disabled={isPending}
                onChange={(event) => setField(field.name, event.target.value)}
                rows={3}
                value={form[field.name]}
              />
              {renderError(field.name)}
            </label>
          ))}
        </div>

        <div className="checkbox-grid">
          {CHECKBOX_FIELDS.map((field) => (
            <label className="checkbox-field" key={field.name}>
              <input
                checked={form[field.name]}
                disabled={isPending}
                onChange={(event) => setField(field.name, event.target.checked)}
                type="checkbox"
              />
              <span>{field.label}</span>
            </label>
          ))}
        </div>

        <div className="form-actions">
          <button className="primary-button" disabled={isPending} type="submit">
            {editingId ? "Save" : "Create"}
          </button>
          {editingId ? (
            <button
              className="secondary-button"
              disabled={isPending}
              onClick={resetForm}
              type="button"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
