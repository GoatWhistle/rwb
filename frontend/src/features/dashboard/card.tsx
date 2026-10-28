import { BarChart3, Download, Table2 } from "lucide-react"
import type { CSSProperties, MouseEvent, ReactNode } from "react"
import { useState } from "react"
import type { Row } from "@/shared/format"
import { downloadCsv } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { ErrorState, IconButton, Tip } from "@/shared/ui/controls"
import "@/shared/styles/overview-sales.css"

export interface CardQuery {
  isPending: boolean
  isError: boolean
  refetch: () => unknown
}

export function AccentTitle({ text, accent }: { text: string; accent: string }) {
  const at = text.toLowerCase().indexOf(accent.toLowerCase())
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <em className="accent-word">{text.slice(at, at + accent.length)}</em>
      {text.slice(at + accent.length)}
    </>
  )
}

export function Card({
  title,
  accent,
  description,
  actions,
  query,
  index = 0,
  className = "",
  children,
}: {
  title: string
  accent: string
  description?: string | undefined
  actions?: ReactNode
  query?: CardQuery | undefined
  index?: number | undefined
  className?: string
  children: ReactNode
}) {
  const body = query?.isError ? (
    <ErrorState retry={() => void query.refetch()} />
  ) : query?.isPending ? (
    <div className="card-skeleton" role="status" aria-label={ru.loading}>
      <span />
      <span />
      <span />
    </div>
  ) : (
    children
  )
  return (
    <section
      className={`panel dash-card ${className}`}
      style={{ "--i": index } as CSSProperties}
      aria-busy={query?.isPending || undefined}
    >
      <div className="panel-heading">
        <div>
          <h2>
            <AccentTitle text={title} accent={accent} />
          </h2>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {body}
    </section>
  )
}

function downloadPng(event: MouseEvent<HTMLElement>, filename: string) {
  const svg = event.currentTarget.closest(".dash-card")?.querySelector("svg.chart-svg")
  if (!(svg instanceof SVGSVGElement)) return
  const box = svg.viewBox.baseVal
  const clone = svg.cloneNode(true) as SVGSVGElement
  for (const node of Array.from(svg.querySelectorAll("*"))) {
    const style = getComputedStyle(node)
    const target = clone.querySelectorAll("*")[Array.from(svg.querySelectorAll("*")).indexOf(node)]
    if (target instanceof SVGElement)
      target.setAttribute(
        "style",
        `fill:${style.fill};stroke:${style.stroke};stroke-width:${style.strokeWidth};stroke-dasharray:${style.strokeDasharray};opacity:${style.opacity};font:${style.font}`,
      )
  }
  clone.setAttribute("width", String(box.width))
  clone.setAttribute("height", String(box.height))
  const image = new Image()
  image.onload = () => {
    const canvas = document.createElement("canvas")
    canvas.width = box.width * 2
    canvas.height = box.height * 2
    const context = canvas.getContext("2d")
    if (!context) return
    context.fillStyle = "#fff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.scale(2, 2)
    context.drawImage(image, 0, 0)
    const link = document.createElement("a")
    link.href = canvas.toDataURL("image/png")
    link.download = filename
    link.click()
  }
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`
}

export function CardTools({
  help,
  onAsk,
  rows,
  filename,
  view,
  onView,
  png = true,
}: {
  help: string
  onAsk?: (() => void) | undefined
  rows: Row[]
  filename: string
  view?: "chart" | "table" | undefined
  onView?: ((view: "chart" | "table") => void) | undefined
  png?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="os-tools">
      {view && onView && (
        <div className="os-view">
          <IconButton
            label={ru.chart}
            aria-pressed={view === "chart"}
            className={view === "chart" ? "on" : ""}
            onClick={() => onView("chart")}
          >
            <BarChart3 size={16} />
          </IconButton>
          <IconButton
            label={ru.table}
            aria-pressed={view === "table"}
            className={view === "table" ? "on" : ""}
            onClick={() => onView("table")}
          >
            <Table2 size={16} />
          </IconButton>
        </div>
      )}
      <Tip text={help} onAsk={onAsk} />
      <div className="os-menu">
        <IconButton
          label="Скачать"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          onBlur={(e) => {
            if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) setOpen(false)
          }}
        >
          <Download size={16} />
        </IconButton>
        {open && (
          <div className="os-menu-list">
            <button
              type="button"
              onClick={() => {
                downloadCsv(rows, `${filename}.csv`)
                setOpen(false)
              }}
            >
              CSV<span>таблица</span>
            </button>
            <button
              type="button"
              disabled={!png || view === "table"}
              onClick={(e) => {
                downloadPng(e, `${filename}.png`)
                setOpen(false)
              }}
            >
              PNG<span>график</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
