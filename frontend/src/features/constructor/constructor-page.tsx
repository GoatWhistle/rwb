import {
  Check,
  Library as LibraryIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
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
import "@/shared/styles/ctor-clean.css"
import { Canvas } from "./canvas"
import { CtorEmpty } from "./empty-state"
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
  const [toast, notify] = useToast()
  const list = dashboards.data ?? []
  const active = list.find((d) => d.id === activeId) ?? list[0] ?? null
  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id)
  }, [active, activeId])
  const byId = useMemo(() => new Map((widgets.data ?? []).map((w) => [w.id, w])), [widgets.data])

  const setItems = (dashboard: CustomDashboard, items: DashboardItem[]) => {
    if (items.length < dashboard.items.length) notify(ru.ctorToastRemoved)
    update.mutate({ ...dashboard, items })
  }
  const addWidget = (widget: WidgetSpec) => {
    if (!active || active.items.some((item) => item.widget_id === widget.id)) return
    update.mutate({
      ...active,
      items: [...active.items, { widget_id: widget.id, size: DEFAULT_SIZE[widget.kind] }],
    })
    notify(ru.ctorToastAdded)
  }
  const createDashboard = () =>
    create.mutate(ru.ctorNewDashboardTitle(list.length + 1), {
      onSuccess: (d) => setActiveId(d.id),
    })

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
      <h1 className="sr-only">{ru.constructor}</h1>
      <div className="ctor-bar">
        <Switcher
          dashboards={list}
          activeId={active?.id ?? null}
          loading={loading}
          onSelect={setActiveId}
          onCreate={createDashboard}
          creating={create.isPending}
        />
        <Button
          className={`ctor-library-toggle${library ? " active" : ""}`}
          aria-expanded={library}
          onClick={() => setLibrary(!library)}
        >
          <LibraryIcon size={15} />
          {ru.ctorLibrary}
        </Button>
      </div>
      <section className="ctor-board" aria-label={active?.title ?? ru.ctorDashboards}>
        <WidgetGenerator filters={filters} onCreated={addWidget} />
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
        ) : active ? (
          <Canvas
            key={active.id}
            items={active.items}
            widgets={byId}
            filters={filters}
            onChange={(items) => setItems(active, items)}
            onOpenLibrary={() => setLibrary(true)}
          />
        ) : (
          <CtorEmpty
            lead={ru.ctorEmptyLead}
            accent={ru.ctorEmptyAccent}
            hint={ru.ctorNoDashboardsHint}
            action={
              <Button className="primary" disabled={create.isPending} onClick={createDashboard}>
                <Plus size={15} />
                {ru.ctorNewDashboard}
              </Button>
            }
          />
        )}
      </section>
      {createPortal(
        <div className="ctor ctor-layer">
          <div
            className={`ctor-backdrop${library ? " open" : ""}`}
            aria-hidden="true"
            onClick={() => setLibrary(false)}
          />
          <Library
            open={library}
            widgets={widgets.data ?? []}
            placed={new Set(active?.items.map((item) => item.widget_id) ?? [])}
            canAdd={Boolean(active)}
            onAdd={addWidget}
            onClose={() => setLibrary(false)}
          />
          <Toast toast={toast} />
        </div>,
        document.body,
      )}
    </div>
  )
}

type ToastState = { text: string; id: number } | null

function useToast() {
  const [toast, setToast] = useState<ToastState>(null)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const notify = (text: string) => {
    window.clearTimeout(timer.current)
    setToast((current) => ({ text, id: (current?.id ?? 0) + 1 }))
    timer.current = window.setTimeout(() => setToast(null), 2400)
  }
  return [toast, notify] as const
}

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div className="ctor-toast-region" role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className="ctor-toast">
          <Check size={15} aria-hidden="true" />
          {toast.text}
        </div>
      )}
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
  const [menu, setMenu] = useState<string | null>(null)
  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return
      if (e instanceof PointerEvent && (e.target as Element).closest(".switcher-menu-wrap")) return
      setMenu(null)
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", close)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", close)
    }
  }, [menu])
  const save = (dashboard: CustomDashboard) => {
    const next = title.trim()
    if (next && next !== dashboard.title) update.mutate({ ...dashboard, title: next })
    setEditing(null)
  }
  return (
    <nav className="ctor-switcher" aria-label={ru.ctorDashboards}>
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
                  <span>{dashboard.title}</span>
                  <small>{dashboard.items.length}</small>
                </button>
                <span className="switcher-menu-wrap">
                  <IconButton
                    label={ru.ctorMore}
                    className="switcher-more"
                    aria-expanded={menu === dashboard.id}
                    onClick={() => setMenu(menu === dashboard.id ? null : dashboard.id)}
                  >
                    <MoreHorizontal size={15} />
                  </IconButton>
                  {menu === dashboard.id && (
                    <div className="tile-menu switcher-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenu(null)
                          setTitle(dashboard.title)
                          setEditing(dashboard.id)
                        }}
                      >
                        <Pencil size={14} />
                        {ru.ctorRename}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="danger"
                        onClick={() => {
                          setMenu(null)
                          setConfirm(dashboard.id)
                        }}
                      >
                        <Trash2 size={14} />
                        {ru.ctorDeleteDashboard}
                      </button>
                    </div>
                  )}
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
