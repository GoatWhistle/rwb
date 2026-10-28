import { GripVertical, LayoutGrid, MoreHorizontal, Plus, RefreshCw, X } from "lucide-react"
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { Filters } from "@/shared/api/metrics"
import type { DashboardItem, WidgetSize, WidgetSpec } from "@/shared/api/widget-types"
import { useRefreshWidget } from "@/shared/api/widgets"
import { ru } from "@/shared/i18n/ru"
import { Button, IconButton } from "@/shared/ui/controls"
import { WidgetView } from "./widget-view"

const SIZES: WidgetSize[] = ["s", "m", "l", "xl"]
const SPAN: Record<WidgetSize, number> = { s: 3, m: 6, l: 9, xl: 12 }

function useFlip(order: string) {
  const root = useRef<HTMLDivElement>(null)
  const rects = useRef(new Map<string, DOMRect>())
  useLayoutEffect(() => {
    if (!order) return
    const tiles = root.current?.querySelectorAll<HTMLElement>("[data-tile]") ?? []
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    for (const tile of Array.from(tiles)) {
      const id = tile.dataset.tile ?? ""
      const next = tile.getBoundingClientRect()
      const prev = rects.current.get(id)
      rects.current.set(id, next)
      if (!prev || reduce || tile.classList.contains("dragging")) continue
      const dx = prev.left - next.left
      const dy = prev.top - next.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
      tile.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      )
    }
  }, [order])
  return root
}

export function Canvas({
  items,
  widgets,
  filters,
  onChange,
  onOpenLibrary,
}: {
  items: DashboardItem[]
  widgets: Map<string, WidgetSpec>
  filters: Filters
  onChange: (items: DashboardItem[]) => void
  onOpenLibrary: () => void
}) {
  const [draft, setDraft] = useState<DashboardItem[] | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [leaving, setLeaving] = useState<string | null>(null)
  const shown = (draft ?? items).filter((item) => widgets.has(item.widget_id))
  const root = useFlip(shown.map((item) => `${item.widget_id}:${item.size}`).join("|"))
  const live = useRef<DashboardItem[]>(shown)
  live.current = shown

  const move = (id: string, to: number) => {
    const list = [...live.current]
    const from = list.findIndex((item) => item.widget_id === id)
    if (from < 0 || to < 0 || to >= list.length || from === to) return null
    const [item] = list.splice(from, 1)
    if (item) list.splice(to, 0, item)
    return list
  }

  const startDrag = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(id)
    setDraft(live.current)
  }
  const dragMove = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (dragging !== id) return
    const target = document
      .elementsFromPoint(event.clientX, event.clientY)
      .map((el) => el.closest<HTMLElement>("[data-tile]"))
      .find((el) => el && el.dataset.tile !== id)
    const over = target?.dataset.tile
    if (!over) return
    const to = live.current.findIndex((item) => item.widget_id === over)
    const next = move(id, to)
    if (next) setDraft(next)
  }
  const endDrag = () => {
    if (!dragging) return
    setDragging(null)
    if (draft && draft.map((i) => i.widget_id).join() !== items.map((i) => i.widget_id).join())
      onChange(draft)
    setDraft(null)
  }

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, id: string, index: number) => {
    const delta = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key]
    if (!delta) return
    event.preventDefault()
    const next = move(id, index + delta)
    if (next) onChange(next)
    requestAnimationFrame(() =>
      root.current?.querySelector<HTMLElement>(`[data-tile="${id}"] .tile-handle`)?.focus(),
    )
  }

  const remove = (id: string) => {
    setLeaving(id)
    window.setTimeout(() => {
      setLeaving(null)
      onChange(live.current.filter((item) => item.widget_id !== id))
    }, 200)
  }

  if (!shown.length)
    return (
      <div className="canvas-empty">
        <span className="canvas-empty-icon" aria-hidden="true">
          <LayoutGrid size={22} />
        </span>
        <h3>{ru.ctorCanvasEmpty}</h3>
        <p>{ru.ctorCanvasEmptyHint}</p>
        <Button className="primary" onClick={onOpenLibrary}>
          <Plus size={15} />
          {ru.ctorOpenLibrary}
        </Button>
      </div>
    )

  return (
    <div ref={root} className={`canvas-grid${dragging ? " is-dragging" : ""}`}>
      {shown.map((item, index) => {
        const widget = widgets.get(item.widget_id)
        if (!widget) return null
        return (
          <Tile
            key={item.widget_id}
            widget={widget}
            size={item.size}
            index={index}
            filters={filters}
            dragging={dragging === item.widget_id}
            leaving={leaving === item.widget_id}
            onHandleDown={(e) => startDrag(e, item.widget_id)}
            onHandleMove={(e) => dragMove(e, item.widget_id)}
            onHandleUp={endDrag}
            onHandleKey={(e) => onKey(e, item.widget_id, index)}
            onSize={(size) =>
              onChange(
                live.current.map((it) => (it.widget_id === item.widget_id ? { ...it, size } : it)),
              )
            }
            onRemove={() => remove(item.widget_id)}
          />
        )
      })}
    </div>
  )
}

function Tile({
  widget,
  size,
  index,
  filters,
  dragging,
  leaving,
  onHandleDown,
  onHandleMove,
  onHandleUp,
  onHandleKey,
  onSize,
  onRemove,
}: {
  widget: WidgetSpec
  size: WidgetSize
  index: number
  filters: Filters
  dragging: boolean
  leaving: boolean
  onHandleDown: (event: PointerEvent<HTMLButtonElement>) => void
  onHandleMove: (event: PointerEvent<HTMLButtonElement>) => void
  onHandleUp: () => void
  onHandleKey: (event: KeyboardEvent<HTMLButtonElement>) => void
  onSize: (size: WidgetSize) => void
  onRemove: () => void
}) {
  const [menu, setMenu] = useState(false)
  const refresh = useRefreshWidget()
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const close = (event: globalThis.PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [menu])
  const stale = JSON.stringify(widget.filters ?? {}) !== JSON.stringify(filters)
  return (
    <section
      data-tile={widget.id}
      className={`panel ctor-tile kind-${widget.kind}${dragging ? " dragging" : ""}${leaving ? " leaving" : ""}`}
      style={{ "--span": SPAN[size], "--i": index } as CSSProperties}
      aria-label={widget.title}
    >
      <header className="tile-head">
        <button
          type="button"
          className="tile-handle"
          aria-label={`${ru.ctorMove}: ${widget.title}`}
          title={ru.ctorMoveHint}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          onKeyDown={onHandleKey}
        >
          <GripVertical size={15} />
        </button>
        <div className="tile-title">
          <h2>{widget.title}</h2>
          {size !== "s" && widget.description && <p>{widget.description}</p>}
        </div>
        <div className="tile-actions">
          <IconButton
            label={ru.ctorRefresh}
            className={`${refresh.isPending ? "spinning" : ""}${stale ? " stale" : ""}`}
            disabled={refresh.isPending}
            onClick={() => refresh.mutate({ id: widget.id, filters })}
          >
            <RefreshCw size={14} />
          </IconButton>
          <div className="os-menu" ref={menuRef}>
            <IconButton
              label={ru.widgetMenu}
              aria-expanded={menu}
              aria-haspopup="menu"
              onClick={() => setMenu(!menu)}
            >
              <MoreHorizontal size={16} />
            </IconButton>
            {menu && (
              <div className="tile-menu" role="menu">
                <span className="tile-menu-label">{ru.ctorSize}</span>
                <fieldset className="tile-sizes" aria-label={ru.ctorSize}>
                  {SIZES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="menuitemradio"
                      aria-checked={option === size}
                      className={option === size ? "active" : ""}
                      onClick={() => {
                        onSize(option)
                        setMenu(false)
                      }}
                    >
                      {option.toUpperCase()}
                    </button>
                  ))}
                </fieldset>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    refresh.mutate({ id: widget.id, filters })
                    setMenu(false)
                  }}
                >
                  <RefreshCw size={14} />
                  {ru.ctorRefresh}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    setMenu(false)
                    onRemove()
                  }}
                >
                  <X size={14} />
                  {ru.ctorRemoveFromDashboard}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className={`tile-body${refresh.isPending ? " refreshing" : ""}`}>
        {refresh.isError && <p className="tile-error">{ru.ctorRefreshError}</p>}
        <WidgetView widget={widget} />
      </div>
    </section>
  )
}
