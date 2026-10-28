import type { ReactNode } from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import "@/shared/styles/chart.css"
import "@/shared/styles/viz-tip.css"

export interface TipRow {
  label: string
  value: string
  color?: string
  swatch?: string
}

export function tipAttrs(head: string, rows: TipRow[]) {
  return { "data-tip-head": head, "data-tip-rows": JSON.stringify(rows) }
}

interface TipState {
  head: string
  rows: TipRow[]
  anchor: TipAnchor
}

const GAP = 8
const EDGE = 8

export interface TipAnchor {
  x: number
  top: number
  bottom: number
}

export function placeTip(node: HTMLElement, anchor: TipAnchor) {
  const width = node.offsetWidth
  const height = node.offsetHeight
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const left = Math.min(Math.max(anchor.x - width / 2, EDGE), Math.max(vw - width - EDGE, EDGE))
  const above = anchor.top - height - GAP
  const below = anchor.bottom + GAP
  const top =
    above >= EDGE || below + height > vh - EDGE
      ? Math.max(above, EDGE)
      : Math.min(below, vh - height - EDGE)
  node.style.left = `${left}px`
  node.style.top = `${top}px`
  node.style.visibility = ""
}

export function FloatTip({
  anchor,
  className,
  children,
}: {
  anchor: TipAnchor | null
  className?: string
  children: ReactNode
}) {
  const node = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (node.current && anchor) placeTip(node.current, anchor)
  }, [anchor])
  useEffect(() => {
    if (!anchor) return
    const hide = () => {
      if (node.current) node.current.style.visibility = "hidden"
    }
    window.addEventListener("scroll", hide, true)
    return () => window.removeEventListener("scroll", hide, true)
  }, [anchor])
  if (!anchor || typeof document === "undefined") return null
  return createPortal(
    <div
      ref={node}
      className={`chart-tooltip tip-float${className ? ` ${className}` : ""}`}
      role="tooltip"
    >
      {children}
    </div>,
    document.body,
  )
}

function readRows(value: string | null): TipRow[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as TipRow[]) : []
  } catch {
    return []
  }
}

export function VizTip({ children, className }: { children: ReactNode; className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<TipState | null>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let active: Element | null = null
    const show = (event: Event) => {
      const target =
        event.target instanceof Element ? event.target.closest("[data-tip-head]") : null
      if (!target || !el.contains(target) || target === active) return
      active?.classList.remove("viz-tip-on")
      active = target
      target.classList.add("viz-tip-on")
      const rect = target.getBoundingClientRect()
      setState({
        head: target.getAttribute("data-tip-head") ?? "",
        rows: readRows(target.getAttribute("data-tip-rows")),
        anchor: { x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom },
      })
    }
    const hide = (event: Event) => {
      const next = event instanceof FocusEvent ? event.relatedTarget : null
      if (next instanceof Node && el.contains(next)) return
      active?.classList.remove("viz-tip-on")
      active = null
      setState(null)
    }
    el.addEventListener("pointerover", show)
    el.addEventListener("focusin", show)
    el.addEventListener("pointerleave", hide)
    el.addEventListener("focusout", hide)
    return () => {
      el.removeEventListener("pointerover", show)
      el.removeEventListener("focusin", show)
      el.removeEventListener("pointerleave", hide)
      el.removeEventListener("focusout", hide)
    }
  }, [])

  return (
    <div ref={host} className={`viz-tip-host${className ? ` ${className}` : ""}`}>
      {children}
      {state && (
        <FloatTip anchor={state.anchor} className="viz-tip">
          <span className="chart-tooltip-head">{state.head}</span>
          {state.rows.map((row) => (
            <span key={row.label} className="chart-tooltip-row">
              <span
                className={`chart-swatch viz-tip-swatch${row.swatch ? ` ${row.swatch}` : ""}`}
                style={row.color ? { background: row.color } : undefined}
              />
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </span>
          ))}
        </FloatTip>
      )}
    </div>
  )
}
