import { CircleHelp, Plus, X } from "lucide-react"
import type { CSSProperties } from "react"
import { useEffect, useRef, useState } from "react"
import type { DashboardContext } from "@/shared/api/metrics"
import { ru } from "@/shared/i18n/ru"
import { IconButton } from "@/shared/ui/controls"
import { AssistantIcon } from "./assistant-icon"
import { ChatComposer } from "./chat-composer"
import { Message } from "./message"
import { useChat } from "./use-chat"
import { useVoiceInput } from "./use-voice-input"

export function ChatPanel({
  active,
  context,
  contextName,
  initialText,
  requestId,
  onClearContext,
  onClose,
}: {
  active: boolean
  context: DashboardContext
  contextName: string
  initialText: string
  requestId: number
  onClearContext: () => void
  onClose: () => void
}) {
  const chat = useChat()
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const voice = useVoiceInput(active, (text) => {
    setInput((current) =>
      `${current}${current && !/\s$/u.test(current) ? " " : ""}${text}`.slice(0, 20000),
    )
    requestAnimationFrame(() => inputRef.current?.focus())
  })
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
  useEffect(() => {
    if (active) setClosing(false)
  }, [active])
  const suggestions = [ru.suggestion1, ru.suggestion2, ru.suggestion3]
  const send = (text = input) => {
    if (!text.trim() || chat.pending || voice.busy) return
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
          <div className={`chat-title ${chat.pending ? "is-thinking" : ""}`}>
            <span className="assistant-avatar">
              <AssistantIcon />
            </span>
            <h2>{ru.chat}</h2>
          </div>
          <div className="chat-heading-actions">
            <IconButton
              label={ru.newChat}
              onClick={chat.reset}
              disabled={chat.pending || voice.busy}
            >
              <Plus size={18} />
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
              <img
                className="welcome-mark"
                src="/brand/01-strata-sign.svg"
                alt={ru.product}
                width={64}
                height={64}
              />
              <h3 aria-label={ru.welcome}>
                {ru.welcomeLead} <em className="accent-word">{ru.welcomeAccent}</em>?
              </h3>
              <ul className="suggestion-list">
                {suggestions.map((text, i) => (
                  <li key={text} style={{ "--i": i } as CSSProperties}>
                    <button type="button" className="suggestion-row" onClick={() => send(text)}>
                      {text}
                    </button>
                  </li>
                ))}
              </ul>
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
          <ChatComposer
            input={input}
            onInput={setInput}
            inputRef={inputRef}
            pending={chat.pending}
            onSend={() => send()}
            onStop={chat.stop}
            voice={voice}
          />
        </div>
      </aside>
    </>
  )
}
