import { MessageSquare } from "lucide-react"
import { useState } from "react"
import { ChatPanel } from "@/features/chat/chat-panel"
import { Dashboard } from "@/features/dashboard/dashboard"
import { initialFilters } from "@/features/dashboard/filters"
import type { DashboardContext, Filters } from "@/shared/api/metrics"
import { ru } from "@/shared/i18n/ru"
import { IconButton } from "@/shared/ui/controls"
import { DatumLogo } from "@/shared/ui/datum-logo"
import "@/shared/styles/shell.css"
import "@/shared/styles/dashboard.css"
import "@/shared/styles/chat.css"

export function App() {
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [chatOpen, setChatOpen] = useState(() => window.innerWidth > 768)
  const [chatWidth, setChatWidth] = useState(() => (window.innerWidth <= 1024 ? 360 : 400))
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
      className={`app-shell ${chatOpen ? "chat-open" : ""} ${expanded && chatOpen ? "chat-expanded" : ""}`}
      style={{ "--chat-width": `${chatWidth}px` } as React.CSSProperties}
    >
      <a href="#main" className="skip-link">
        {ru.skip}
      </a>
      <header className="app-header shell-enter">
        <div className="header-logo" role="img" aria-label={ru.product}>
          <DatumLogo className="datum-logo-intro" />
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="main-area shell-enter"
        style={{ "--i": 1 } as React.CSSProperties}
      >
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
      <div
        className="chat-area shell-enter"
        style={{ "--i": 2 } as React.CSSProperties}
        hidden={!chatOpen}
      >
        <ChatPanel
          active={chatOpen}
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
      {!chatOpen && (
        <IconButton className="chat-fab" label={ru.openChat} onClick={() => setChatOpen(true)}>
          <MessageSquare size={22} />
        </IconButton>
      )}
    </div>
  )
}
