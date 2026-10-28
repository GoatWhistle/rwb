import {
  Check,
  LayoutDashboard,
  Library as LibraryIcon,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { Filters } from "@/shared/api/metrics"
import type {
  CustomDashboard,
  DashboardItem,
  WidgetKind,
  WidgetSize,
  WidgetSpec,
} from "@/shared/api/widget-types"
import {
  useCreateDashboard,
  useDashboards,
  useRemoveDashboard,
  useUpdateDashboard,
  useWidgets,
} from "@/shared/api/widgets"
import { ru } from "@/shared/i18n/ru"
import { Button, ErrorState, IconButton } from "@/shared/ui/controls"
import "@/shared/styles/constructor.css"
import { Canvas } from "./canvas"
import { WidgetGenerator } from "./generator"
import { Library } from "./library"

const DEFAULT_SIZE: Record<WidgetKind, WidgetSize> = {
  kpi: "s",
  line: "l",
  bar: "m",
  hbar: "m",
  table: "xl",
}

export function ConstructorPage({ filters }: { filters: Filters }) {
  const widgets = useWidgets()
  const dashboards = useDashboards()
  const update = useUpdateDashboard()
  const create = useCreateDashboard()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [library, setLibrary] = useState(false)
  const list = dashboards.data ?? []
  const active = list.find((d) => d.id === activeId) ?? list[0] ?? null
  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id)
  }, [active, activeId])
  const byId = useMemo(() => new Map((widgets.data ?? []).map((w) => [w.id, w])), [widgets.data])

  const setItems = (dashboard: CustomDashboard, items: DashboardItem[]) =>
    update.mutate({ ...dashboard, items })
  const addWidget = (widget: WidgetSpec) => {
    if (!active || active.items.some((item) => item.widget_id === widget.id)) return
    setItems(active, [...active.items, { widget_id: widget.id, size: DEFAULT_SIZE[widget.kind] }])
  }

  if (widgets.isError || dashboards.isError)
    return (
      <ErrorState
        retry={() => {
          void widgets.refetch()
          void dashboards.refetch()
        }}
      />
    )
  const loading = widgets.isPending || dashboards.isPending

  return (
    <div className="ctor">
      <WidgetGenerator filters={filters} onCreated={addWidget} />
      <div className={`ctor-layout${library ? " with-library" : ""}`}>
        <Switcher
          dashboards={list}
          activeId={active?.id ?? null}
          loading={loading}
          onSelect={setActiveId}
          onCreate={() =>
            create.mutate(ru.ctorNewDashboardTitle(list.length + 1), {
              onSuccess: (d) => setActiveId(d.id),
            })
          }
          creating={create.isPending}
        />
        <main className="ctor-main">
          {loading ? (
            <div className="canvas-grid" role="status" aria-label={ru.loading}>
              {[
                ["a", 6],
                ["b", 6],
                ["c", 12],
              ].map(([id, span]) => (
                <div
                  key={id}
                  className="panel ctor-tile tile-skeleton"
                  style={{ gridColumn: `span ${String(span)}` }}
                />
              ))}
            </div>
          ) : !active ? (
            <div className="canvas-empty">
              <span className="canvas-empty-icon" aria-hidden="true">
                <LayoutDashboard size={22} />
              </span>
              <h3>{ru.ctorNoDashboards}</h3>
              <p>{ru.ctorNoDashboardsHint}</p>
              <Button
                className="primary"
                onClick={() =>
                  create.mutate(ru.ctorNewDashboardTitle(1), {
                    onSuccess: (d) => setActiveId(d.id),
                  })
                }
              >
                <Plus size={15} />
                {ru.ctorNewDashboard}
              </Button>
            </div>
          ) : (
            <>
              <div className="ctor-canvas-head">
                <div>
                  <h2>{active.title}</h2>
                  <p>{ru.ctorWidgetCount(active.items.length)}</p>
                </div>
                <Button
                  className={library ? "active" : ""}
                  aria-expanded={library}
                  onClick={() => setLibrary(!library)}
                >
                  <LibraryIcon size={15} />
                  {ru.ctorLibrary}
                </Button>
              </div>
              <Canvas
                key={active.id}
                items={active.items}
                widgets={byId}
                filters={filters}
                onChange={(items) => setItems(active, items)}
                onOpenLibrary={() => setLibrary(true)}
              />
            </>
          )}
        </main>
        <Library
          open={library}
          widgets={widgets.data ?? []}
          placed={new Set(active?.items.map((item) => item.widget_id) ?? [])}
          canAdd={Boolean(active)}
          onAdd={addWidget}
          onClose={() => setLibrary(false)}
        />
      </div>
    </div>
  )
}

function Switcher({
  dashboards,
  activeId,
  loading,
  creating,
  onSelect,
  onCreate,
}: {
  dashboards: CustomDashboard[]
  activeId: string | null
  loading: boolean
  creating: boolean
  onSelect: (id: string) => void
  onCreate: () => void
}) {
  const update = useUpdateDashboard()
  const remove = useRemoveDashboard()
  const [editing, setEditing] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [confirm, setConfirm] = useState<string | null>(null)
  const save = (dashboard: CustomDashboard) => {
    const next = title.trim()
    if (next && next !== dashboard.title) update.mutate({ ...dashboard, title: next })
    setEditing(null)
  }
  return (
    <nav className="ctor-switcher" aria-label={ru.ctorDashboards}>
      <span className="switcher-label">{ru.ctorDashboards}</span>
      <ul>
        {loading && ["a", "b"].map((id) => <li key={id} className="switcher-skeleton" />)}
        {dashboards.map((dashboard) => (
          <li key={dashboard.id} className={dashboard.id === activeId ? "active" : ""}>
            {editing === dashboard.id ? (
              <form
                className="switcher-edit"
                onSubmit={(e) => {
                  e.preventDefault()
                  save(dashboard)
                }}
              >
                <input
                  ref={(el) => el?.focus()}
                  value={title}
                  aria-label={ru.ctorRename}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => save(dashboard)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditing(null)
                  }}
                />
              </form>
            ) : confirm === dashboard.id ? (
              <div className="switcher-confirm" role="alert">
                <span>{ru.ctorDeleteDashboardConfirm}</span>
                <div>
                  <IconButton
                    label={ru.ctorDelete}
                    className="danger"
                    onClick={() => {
                      remove.mutate(dashboard.id)
                      setConfirm(null)
                    }}
                  >
                    <Check size={14} />
                  </IconButton>
                  <IconButton label={ru.ctorCancel} onClick={() => setConfirm(null)}>
                    <X size={14} />
                  </IconButton>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="switcher-item"
                  aria-current={dashboard.id === activeId ? "page" : undefined}
                  onClick={() => onSelect(dashboard.id)}
                  onDoubleClick={() => {
                    setTitle(dashboard.title)
                    setEditing(dashboard.id)
                  }}
                >
                  <LayoutDashboard size={15} aria-hidden="true" />
                  <span>{dashboard.title}</span>
                  <small>{dashboard.items.length}</small>
                </button>
                <span className="switcher-tools">
                  <IconButton
                    label={ru.ctorRename}
                    onClick={() => {
                      setTitle(dashboard.title)
                      setEditing(dashboard.id)
                    }}
                  >
                    <Pencil size={13} />
                  </IconButton>
                  <IconButton
                    label={ru.ctorDeleteDashboard}
                    onClick={() => setConfirm(dashboard.id)}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <Button className="switcher-new" disabled={creating} onClick={onCreate}>
        <Plus size={15} />
        {ru.ctorNewDashboard}
      </Button>
    </nav>
  )
}
