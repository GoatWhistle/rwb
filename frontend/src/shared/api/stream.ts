import type { ChatRequest } from "./metrics"

export interface StreamEvent {
  event: string
  data: Record<string, unknown>
}
export function parseFrame(frame: string): StreamEvent | null {
  const lines = frame.split(/\r?\n/)
  const event =
    lines
      .find((line) => line.startsWith("event:"))
      ?.slice(6)
      .trim() ?? "message"
  const payload = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
  if (!payload) return null
  const data: unknown = JSON.parse(payload)
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("invalid_stream_event")
  return { event, data: data as Record<string, unknown> }
}
export async function consumeStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let terminal = false
  const dispatch = (frame: string) => {
    const item = parseFrame(frame)
    if (!item) return
    if (item.event === "done" || item.event === "error") terminal = true
    onEvent(item)
  }
  try {
    for (;;) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let boundary = /\r?\n\r?\n/.exec(buffer)
      while (boundary) {
        dispatch(buffer.slice(0, boundary.index))
        buffer = buffer.slice(boundary.index + boundary[0].length)
        boundary = /\r?\n\r?\n/.exec(buffer)
      }
      if (done) break
    }
    if (buffer.trim()) dispatch(buffer)
    if (!terminal) throw new Error("stream_incomplete")
  } finally {
    reader.releaseLock()
  }
}
export async function streamChat(
  request: ChatRequest,
  signal: AbortSignal,
  onEvent: (event: StreamEvent) => void,
) {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(request),
    signal,
  })
  if (!response.ok || !response.body) throw new Error(`chat_http_${response.status}`)
  await consumeStream(response.body, onEvent)
}
