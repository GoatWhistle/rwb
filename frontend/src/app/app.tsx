import { useQueryClient } from "@tanstack/react-query"
import {
  ChartNoAxesCombined,
  ChevronRight,
  LayoutDashboard,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  RefreshCw,
} from "lucide-react"
import { useState } from "react"
import { ChatPanel } from "@/features/chat/chat-panel"
import { Dashboard } from "@/features/dashboard/dashboard"
import { initialFilters } from "@/features/dashboard/filters"
import type { DashboardContext, Filters } from "@/shared/api/metrics"
import { ru } from "@/shared/i18n/ru"
import { IconButton } from "@/shared/ui/controls"
import "@/shared/styles/dashboard.css"
import "@/shared/styles/chat.css"

export function App() {
  const client = useQueryClient()
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [chatOpen, setChatOpen] = useState(() => window.innerWidth > 768)
  const [chatWidth, setChatWidth] = useState(() => (window.innerWidth <= 1024 ? 360 : 400))
  const [navOpen, setNavOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [context, setContext] = useState<DashboardContext>({ filters })
  const [contextName, setContextName] = useState("")
  const [draft, setDraft] = useState({ text: "", id: 0 })
  const updateFilters = (value: Filters) => {
    setFilters(value)
    setContext({ filters: value })
    setContextName("")
  }
  const ask = (value: DashboardContext, name: string) => {
    setContext(value)
    setContextName(name)
    setChatOpen(true)
    setDraft((current) => ({
      text: ru.contextQuestion.replace("{{name}}", name),
      id: current.id + 1,
    }))
  }
  return (
    <div
      className={`app-shell ${chatOpen ? "chat-open" : ""} ${expanded && chatOpen ? "chat-expanded" : ""} ${navOpen ? "nav-expanded" : ""}`}
      style={{ "--chat-width": `${chatWidth}px` } as React.CSSProperties}
    >
      <a href="#main" className="skip-link">
        {ru.skip}
      </a>
      <nav className="app-rail" aria-label={ru.product}>
        <div className="nav-heading">
          {navOpen && (
            <a href="/" className="nav-logo" aria-label={ru.product}>
              <img src="/brand/01-strata-lockup.svg" alt="" width={120} height={36} />
            </a>
          )}
          <IconButton
            label={navOpen ? ru.closeNav : ru.openNav}
            aria-expanded={navOpen}
            onClick={() => setNavOpen(!navOpen)}
          >
            {navOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
          </IconButton>
        </div>
        <div className="rail-links">
          <IconButton
            label={ru.overview}
            className="rail-active"
            onClick={() => document.getElementById("main")?.focus()}
          >
            <LayoutDashboard size={20} />
            {navOpen && <span>{ru.overview}</span>}
          </IconButton>
          <IconButton
            label={chatOpen ? ru.closeChat : ru.openChat}
            aria-expanded={chatOpen}
            onClick={() => setChatOpen(!chatOpen)}
          >
            <MessageSquare size={20} />
            {navOpen && <span>{ru.chat}</span>}
          </IconButton>
        </div>
        <div className="rail-bottom">
          <span className="workspace-avatar" title={ru.workspace}>
            C
          </span>
        </div>
      </nav>
      <header className="app-header">
        <div className="header-brand">
          <span>{ru.workspace}</span>
          <ChevronRight size={14} />
          <span className="header-location">{ru.analytics}</span>
        </div>
        <div className="header-actions">
          <IconButton
            className="mobile-nav-toggle"
            label={navOpen ? ru.closeNav : ru.openNav}
            aria-expanded={navOpen}
            onClick={() => setNavOpen(!navOpen)}
          >
            {navOpen ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
          </IconButton>
          <IconButton
            label={ru.refresh}
            onClick={() => {
              void client.invalidateQueries({ queryKey: ["metric"] })
            }}
          >
            <RefreshCw size={17} />
          </IconButton>
          {!chatOpen && (
            <IconButton label={ru.openChat} onClick={() => setChatOpen(true)}>
              <PanelRightOpen size={19} />
            </IconButton>
          )}
          <span className="header-label">
            <ChartNoAxesCombined size={14} />
            {ru.overview}
          </span>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="main-area">
        <Dashboard filters={filters} onFilters={updateFilters} onAsk={ask} />
      </main>
      {chatOpen && (
        <hr
          className="chat-resizer"
          aria-orientation="vertical"
          aria-label={ru.resize}
          aria-valuenow={chatWidth}
          aria-valuemin={340}
          aria-valuemax={800}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
            e.preventDefault()
            setExpanded(false)
            setChatWidth((n) =>
              Math.max(340, Math.min(800, n + (e.key === "ArrowLeft" ? 32 : -32))),
            )
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setExpanded(false)
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              setChatWidth(
                Math.max(
                  340,
                  Math.min(800, window.innerWidth * 0.65, window.innerWidth - e.clientX),
                ),
              )
          }}
          onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
        />
      )}
      <div className="chat-area" hidden={!chatOpen}>
        <ChatPanel
          context={context}
          contextName={contextName}
          initialText={draft.text}
          requestId={draft.id}
          onClearContext={() => {
            setContext({ filters })
            setContextName("")
          }}
          expanded={expanded}
          onExpand={() => setExpanded(!expanded)}
          onClose={() => setChatOpen(false)}
        />
      </div>
    </div>
  )
}
