import { useMutation } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import type { DashboardContext, DataTable } from "@/shared/api/metrics"
import type { StreamEvent } from "@/shared/api/stream"
import { streamChat } from "@/shared/api/stream"
import { ru } from "@/shared/i18n/ru"

export interface ChatChart {
  type: "line" | "bar"
  title: string
  table_id: string
  x: string
  y: string[]
}
export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  tables: Record<string, DataTable>
  charts: ChatChart[]
  sources: Record<string, unknown>[]
  details?: string
  error?: string
  stopped?: boolean
}
const storageKey = "datum-chat-v1"
function readSaved(): { session: string; messages: ChatMessage[] } {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null")
    if (
      saved &&
      typeof saved === "object" &&
      "session" in saved &&
      typeof saved.session === "string" &&
      "messages" in saved &&
      Array.isArray(saved.messages)
    )
      return saved as { session: string; messages: ChatMessage[] }
  } catch {}
  return { session: crypto.randomUUID(), messages: [] }
}
function updateEvent(message: ChatMessage, { event, data }: StreamEvent): ChatMessage {
  switch (event) {
    case "text_delta":
      return { ...message, text: message.text + String(data.delta ?? "") }
    case "done":
      return { ...message, text: typeof data.text === "string" ? data.text : message.text }
    case "error":
      return { ...message, error: ru.chatError }
    case "table": {
      if (
        typeof data.table_id !== "string" ||
        !Array.isArray(data.rows) ||
        !Array.isArray(data.columns)
      )
        return message
      return {
        ...message,
        tables: {
          ...message.tables,
          [data.table_id]: {
            rows: data.rows,
            columns: data.columns,
            truncated: Boolean(data.truncated),
          },
        },
      }
    }
    case "chart": {
      if (
        (data.type !== "line" && data.type !== "bar") ||
        typeof data.table_id !== "string" ||
        typeof data.x !== "string" ||
        !Array.isArray(data.y) ||
        !data.y.every((value) => typeof value === "string")
      )
        return message
      return { ...message, charts: [...message.charts, data as unknown as ChatChart] }
    }
    case "sources":
      return {
        ...message,
        sources: Array.isArray(data.items) ? data.items : [],
        details: typeof data.details === "string" ? data.details : "",
      }
    default:
      return message
  }
}
export function useChat() {
  const [saved] = useState(readSaved)
  const [messages, setMessages] = useState<ChatMessage[]>(saved.messages)
  const session = useRef(saved.session)
  const controller = useRef<AbortController | null>(null)
  const [working, setWorking] = useState(false)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ session: session.current, messages: messages.slice(-30) }),
      )
    } catch {}
  }, [messages])
  const mutation = useMutation({
    retry: false,
    mutationFn: async ({ text, context }: { text: string; context: DashboardContext }) => {
      controller.current = new AbortController()
      const assistantId = crypto.randomUUID()
      const make = (role: ChatMessage["role"], content: string): ChatMessage => ({
        id: crypto.randomUUID(),
        role,
        text: content,
        tables: {},
        charts: [],
        sources: [],
      })
      setMessages((current) => [
        ...current,
        make("user", text),
        { ...make("assistant", ""), id: assistantId },
      ])
      const patch = (transform: (message: ChatMessage) => ChatMessage) =>
        setMessages((current) =>
          current.map((message) => (message.id === assistantId ? transform(message) : message)),
        )
      try {
        setWorking(true)
        await streamChat(
          { session_id: session.current, message: text, dashboard_context: context },
          controller.current.signal,
          (event) => {
            if (typeof event.data.session_id === "string") session.current = event.data.session_id
            if (event.event === "tool_started") setWorking(true)
            if (event.event === "text_delta" || event.event === "done" || event.event === "error")
              setWorking(false)
            patch((message) => updateEvent(message, event))
          },
        )
      } catch (error) {
        if (controller.current?.signal.aborted) patch((message) => ({ ...message, stopped: true }))
        else
          patch((message) => ({
            ...message,
            error:
              error instanceof Error && error.message === "stream_incomplete"
                ? ru.streamLost
                : ru.chatError,
          }))
      } finally {
        setWorking(false)
        controller.current = null
      }
    },
  })
  const send = (text: string, context: DashboardContext) => {
    if (mutation.isPending || controller.current || !text.trim()) return
    mutation.mutate({ text: text.trim(), context })
  }
  const reset = () => {
    if (mutation.isPending) return
    session.current = crypto.randomUUID()
    setMessages([])
  }
  return {
    messages,
    send,
    reset,
    pending: mutation.isPending,
    working,
    stop: () => controller.current?.abort(),
  }
}
