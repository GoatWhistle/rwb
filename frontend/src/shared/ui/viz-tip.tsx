import type { ReactNode } from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
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
  x: number
  top: number
  bottom: number
}

const GAP = 8

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
  const tip = useRef<HTMLDivElement>(null)
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
      const box = el.getBoundingClientRect()
      const rect = target.getBoundingClientRect()
      setState({
        head: target.getAttribute("data-tip-head") ?? "",
        rows: readRows(target.getAttribute("data-tip-rows")),
        x: rect.left + rect.width / 2 - box.left,
        top: rect.top - box.top,
        bottom: rect.bottom - box.top,
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

  useLayoutEffect(() => {
    const el = host.current
    const node = tip.current
    if (!el || !node || !state) return
    const width = node.offsetWidth
    const height = node.offsetHeight
    const left = Math.min(Math.max(state.x - width / 2, 0), Math.max(el.clientWidth - width, 0))
    const above = state.top - height - GAP
    node.style.left = `${left}px`
    node.style.top = `${above >= 0 ? above : state.bottom + GAP}px`
  }, [state])

  return (
    <div ref={host} className={`viz-tip-host${className ? ` ${className}` : ""}`}>
      {children}
      {state && (
        <div ref={tip} className="chart-tooltip viz-tip" role="tooltip">
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
        </div>
      )}
    </div>
  )
}
