import {
  ArrowUp,
  ArrowUpRight,
  CircleHelp,
  Maximize2,
  MessageSquare,
  Minimize2,
  Plus,
  Square,
  TrendingUp,
  Truck,
  Wallet,
  X,
} from "lucide-react"
import type { CSSProperties } from "react"
import { useEffect, useRef, useState } from "react"
import type { DashboardContext } from "@/shared/api/metrics"
import { ru } from "@/shared/i18n/ru"
import { Button, IconButton } from "@/shared/ui/controls"
import { Message } from "./message"
import { useChat } from "./use-chat"

export function ChatPanel({
  context,
  contextName,
  initialText,
  requestId,
  onClearContext,
  expanded,
  onExpand,
  onClose,
}: {
  context: DashboardContext
  contextName: string
  initialText: string
  requestId: number
  onClearContext: () => void
  expanded: boolean
  onExpand: () => void
  onClose: () => void
}) {
  const chat = useChat()
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  const lastRequest = useRef(0)
  useEffect(() => {
    if (requestId === lastRequest.current) return
    lastRequest.current = requestId
    setInput(initialText)
    inputRef.current?.focus()
  }, [initialText, requestId])
  useEffect(() => {
    if (chat.messages.length && follow.current && scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chat.messages])
  const [closing, setClosing] = useState(false)
  const close = () => setClosing(true)
  const suggestions = [
    { text: ru.suggestion1, Icon: TrendingUp },
    { text: ru.suggestion2, Icon: Truck },
    { text: ru.suggestion3, Icon: Wallet },
  ]
  const send = (text = input) => {
    if (!text.trim() || chat.pending) return
    follow.current = true
    chat.send(text, context)
    setInput("")
    inputRef.current?.focus()
  }
  return (
    <>
      <div
        className={`chat-backdrop ${closing ? "is-closing" : ""}`}
        aria-hidden="true"
        onClick={close}
      />
      <aside
        className={`chat-panel ${closing ? "is-closing" : ""}`}
        aria-label={ru.chat}
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) onClose()
        }}
      >
        <div className="chat-heading">
          <div className="chat-title">
            <MessageSquare size={18} />
            <div>
              <h2>{ru.chat}</h2>
              <p>{ru.chatDescription}</p>
            </div>
          </div>
          <div className="chat-heading-actions">
            <IconButton label={ru.newChat} onClick={chat.reset} disabled={chat.pending}>
              <Plus size={18} />
            </IconButton>
            <IconButton label={expanded ? ru.contract : ru.expand} onClick={onExpand}>
              <span className="expand-chat-icon">
                {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </span>
            </IconButton>
            <IconButton label={ru.closeChat} onClick={close}>
              <X size={18} />
            </IconButton>
          </div>
        </div>
        <div
          className="chat-scroll"
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget
            follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
          }}
        >
          {chat.messages.length === 0 ? (
            <div className="chat-welcome">
              <h3 aria-label={ru.welcome}>
                {ru.welcomeLead} <em className="accent-word">{ru.welcomeAccent}</em>?
              </h3>
              <p>{ru.welcomeNote}</p>
              <div className="suggestions">
                {suggestions.map(({ text, Icon }, i) => (
                  <Button
                    key={text}
                    className="suggestion-card"
                    style={{ "--i": i } as CSSProperties}
                    onClick={() => send(text)}
                  >
                    <span className="suggestion-icon">
                      <Icon size={16} />
                    </span>
                    <span className="suggestion-text">{text}</span>
                    <ArrowUpRight size={16} className="suggestion-arrow" />
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-messages">
              {chat.messages.map((message, i) => (
                <Message
                  key={message.id}
                  message={message}
                  streaming={chat.pending && i === chat.messages.length - 1}
                />
              ))}
              {chat.pending && (
                <div className="chat-status chat-thinking" role="status">
                  <span className="thinking-dot" />
                  <span className="shimmer-text">{chat.working ? ru.running : ru.thinking}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="chat-composer-area">
          {contextName && (
            <div className="context-chip">
              <CircleHelp size={13} />
              <span>{contextName}</span>
              <IconButton label={ru.removeContext} onClick={onClearContext}>
                <X size={12} />
              </IconButton>
            </div>
          )}
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              maxLength={20000}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ru.placeholder}
              aria-label={ru.placeholder}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <IconButton
              label={chat.pending ? ru.stop : ru.send}
              className={`send-button ${input.trim() || chat.pending ? "ready" : ""}`}
              onClick={() => (chat.pending ? chat.stop() : send())}
              disabled={!chat.pending && !input.trim()}
            >
              {chat.pending ? <Square size={17} /> : <ArrowUp size={21} />}
            </IconButton>
          </form>
        </div>
      </aside>
    </>
  )
}
