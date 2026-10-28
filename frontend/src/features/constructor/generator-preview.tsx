import { ChevronDown, Plus, RotateCcw, Sparkles } from "lucide-react"
import { useId, useState } from "react"
import type { WidgetDraft, WidgetKind } from "@/shared/api/widget-types"
import { ru } from "@/shared/i18n/ru"
import { Segmented } from "@/shared/ui/controls"
import { WidgetView } from "./widget-view"

const KIND_ORDER: WidgetKind[] = ["kpi", "line", "bar", "hbar", "table"]

export function validKinds(draft: WidgetDraft): WidgetKind[] {
  const numericY = draft.y.filter((name) => {
    const column = draft.columns.find((c) => c.name === name)
    return column !== undefined && column.type !== "text" && column.type !== "date"
  })
  const xColumn = draft.x ? draft.columns.find((c) => c.name === draft.x) : undefined
  const hasSeries = xColumn !== undefined && numericY.length > 0 && draft.rows.length > 1
  return KIND_ORDER.filter((kind) => {
    if (kind === "table") return true
    if (kind === "kpi") return numericY.length > 0 && draft.rows.length === 1
    if (kind === "line") return hasSeries && xColumn?.type === "date"
    return hasSeries
  })
}

export function GeneratorPreview({
  draft,
  saving,
  busy,
  onKind,
  onSave,
  onRedo,
  onRefine,
}: {
  draft: WidgetDraft
  saving: boolean
  busy: boolean
  onKind: (kind: WidgetKind) => void
  onSave: () => void
  onRedo: () => void
  onRefine: (text: string) => void
}) {
  const [sqlOpen, setSqlOpen] = useState(false)
  const [refine, setRefine] = useState("")
  const sqlId = useId()
  const kinds = validKinds(draft)
  const submitRefine = () => {
    const text = refine.trim()
    if (!text || busy) return
    onRefine(text)
    setRefine("")
  }
  return (
    <article className="gen-preview">
      <header className="gen-preview-head">
        <div className="gen-preview-titles">
          <h3>{draft.title}</h3>
          {draft.description && <p>{draft.description}</p>}
        </div>
        <span className="gen-preview-rows">{`${draft.rows.length} ${ru.genRows}`}</span>
      </header>
      {kinds.length > 1 && (
        <div className="gen-preview-kinds">
          <Segmented
            label={ru.genKindLabel}
            value={draft.kind}
            onChange={onKind}
            options={kinds.map((kind) => ({ value: kind, label: ru.genKinds[kind] }))}
          />
        </div>
      )}
      <div className="gen-preview-canvas">
        <WidgetView widget={draft} />
      </div>
      <div className="gen-sql">
        <button
          type="button"
          className="gen-sql-toggle"
          aria-expanded={sqlOpen}
          aria-controls={sqlId}
          onClick={() => setSqlOpen((open) => !open)}
        >
          <span>{sqlOpen ? ru.genSqlHide : ru.genSqlShow}</span>
          <ChevronDown size={16} className="gen-sql-chevron" />
        </button>
        <div className="gen-sql-body" id={sqlId} data-open={sqlOpen}>
          <div className="gen-sql-inner">
            <pre title={ru.genSql}>
              <code>{draft.sql}</code>
            </pre>
          </div>
        </div>
      </div>
      <form
        className="gen-refine"
        onSubmit={(event) => {
          event.preventDefault()
          submitRefine()
        }}
      >
        <Sparkles size={16} className="gen-refine-icon" aria-hidden="true" />
        <input
          value={refine}
          onChange={(event) => setRefine(event.target.value)}
          placeholder={ru.genRefinePlaceholder}
          aria-label={ru.genRefinePlaceholder}
          disabled={busy}
          maxLength={2000}
        />
        <button type="submit" className="gen-refine-submit" disabled={busy || !refine.trim()}>
          {ru.genRefine}
        </button>
      </form>
      <footer className="gen-preview-actions">
        <button type="button" className="gen-btn gen-btn-ghost" onClick={onRedo} disabled={busy}>
          <RotateCcw size={16} aria-hidden="true" />
          {ru.genRedo}
        </button>
        <button
          type="button"
          className="gen-btn gen-btn-primary"
          onClick={onSave}
          disabled={busy || saving}
        >
          <Plus size={17} aria-hidden="true" />
          {saving ? ru.genSaving : ru.genSave}
        </button>
      </footer>
    </article>
  )
}
