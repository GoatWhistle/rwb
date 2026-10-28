import {
  ArrowUpRight,
  CircleHelp,
  Maximize2,
  MessageSquare,
  Minimize2,
  Plus,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { DashboardContext } from "@/shared/api/metrics"
import { ru } from "@/shared/i18n/ru"
import { Button, IconButton } from "@/shared/ui/controls"
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
  expanded,
  onExpand,
  onClose,
}: {
  active: boolean
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
  const send = (text = input) => {
    if (!text.trim() || chat.pending || voice.busy) return
    follow.current = true
    chat.send(text, context)
    setInput("")
    inputRef.current?.focus()
  }
  return (
    <aside className="chat-panel" aria-label={ru.chat}>
      <div className="chat-heading">
        <div className="chat-title">
          <MessageSquare size={18} />
          <div>
            <h2>{ru.chat}</h2>
            <p>{ru.chatDescription}</p>
          </div>
        </div>
        <div className="chat-heading-actions">
          <IconButton label={ru.newChat} onClick={chat.reset} disabled={chat.pending || voice.busy}>
            <Plus size={18} />
          </IconButton>
          <IconButton label={expanded ? ru.contract : ru.expand} onClick={onExpand}>
            <span className="expand-chat-icon">
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </span>
          </IconButton>
          <IconButton label={ru.closeChat} onClick={onClose}>
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
            <h3>{ru.welcome}</h3>
            <p>{ru.welcomeNote}</p>
            <div className="suggestions">
              {[ru.suggestion1, ru.suggestion2, ru.suggestion3].map((text) => (
                <Button key={text} onClick={() => send(text)}>
                  {text}
                  <ArrowUpRight size={16} />
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {chat.messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
            {chat.pending && (
              <div className="chat-status" role="status">
                <span className="thinking-dot" />
                {chat.working ? ru.running : ru.thinking}
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
          onReset={chat.reset}
          voice={voice}
        />
      </div>
    </aside>
  )
}
