import { Check, Library as LibraryIcon, Plus, Search, Trash2, X } from "lucide-react"
import type { CSSProperties } from "react"
import { useState } from "react"
import type { WidgetSpec } from "@/shared/api/widget-types"
import { useRemoveWidget } from "@/shared/api/widgets"
import { ru } from "@/shared/i18n/ru"
import { Button, IconButton } from "@/shared/ui/controls"
import { WidgetView } from "./widget-view"

export function Library({
  open,
  widgets,
  placed,
  canAdd,
  onAdd,
  onClose,
}: {
  open: boolean
  widgets: WidgetSpec[]
  placed: Set<string>
  canAdd: boolean
  onAdd: (widget: WidgetSpec) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [confirm, setConfirm] = useState<string | null>(null)
  const remove = useRemoveWidget()
  const needle = query.trim().toLowerCase()
  const found = widgets.filter(
    (w) =>
      !needle ||
      w.title.toLowerCase().includes(needle) ||
      w.description.toLowerCase().includes(needle),
  )
  return (
    <aside
      className={`ctor-library${open ? " open" : ""}`}
      aria-label={ru.ctorLibrary}
      aria-hidden={!open}
    >
      <header className="library-head">
        <div>
          <h2>{ru.ctorLibrary}</h2>
          <p>{ru.ctorLibraryCount(widgets.length)}</p>
        </div>
        <IconButton label={ru.ctorCloseLibrary} onClick={onClose} tabIndex={open ? 0 : -1}>
          <X size={16} />
        </IconButton>
      </header>
      <label className="library-search">
        <Search size={14} aria-hidden="true" />
        <input
          value={query}
          placeholder={ru.ctorSearch}
          aria-label={ru.ctorSearch}
          tabIndex={open ? 0 : -1}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="library-list">
        {!widgets.length ? (
          <div className="library-empty">
            <LibraryIcon size={20} aria-hidden="true" />
            <p>{ru.ctorLibraryEmpty}</p>
          </div>
        ) : !found.length ? (
          <div className="library-empty">
            <p>{ru.ctorNothingFound}</p>
          </div>
        ) : (
          found.map((widget, i) => {
            const isPlaced = placed.has(widget.id)
            return (
              <article
                key={widget.id}
                className="library-card"
                style={{ "--i": i } as CSSProperties}
              >
                <div className="library-preview" aria-hidden="true">
                  <WidgetView widget={widget} compact />
                </div>
                <div className="library-meta">
                  <span className={`kind-badge kind-${widget.kind}`}>
                    {ru.ctorKinds[widget.kind]}
                  </span>
                  <h3>{widget.title}</h3>
                </div>
                {confirm === widget.id ? (
                  <div className="library-confirm" role="alert">
                    <span>{ru.ctorDeleteWidgetConfirm}</span>
                    <Button
                      className="danger"
                      tabIndex={open ? 0 : -1}
                      onClick={() => {
                        remove.mutate(widget.id)
                        setConfirm(null)
                      }}
                    >
                      {ru.ctorDelete}
                    </Button>
                    <Button tabIndex={open ? 0 : -1} onClick={() => setConfirm(null)}>
                      {ru.ctorCancel}
                    </Button>
                  </div>
                ) : (
                  <div className="library-actions">
                    <Button
                      className={isPlaced ? "placed" : "primary"}
                      disabled={isPlaced || !canAdd}
                      tabIndex={open ? 0 : -1}
                      onClick={() => onAdd(widget)}
                    >
                      {isPlaced ? <Check size={14} /> : <Plus size={14} />}
                      {isPlaced ? ru.ctorOnDashboard : ru.ctorAddToDashboard}
                    </Button>
                    <IconButton
                      label={ru.ctorDeleteWidget}
                      tabIndex={open ? 0 : -1}
                      onClick={() => setConfirm(widget.id)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                )}
              </article>
            )
          })
        )}
      </div>
    </aside>
  )
}
