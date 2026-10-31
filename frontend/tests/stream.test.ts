import { describe, expect, it } from "vitest"
import { consumeStream, parseFrame } from "../src/shared/api/stream"

describe("chat stream", () => {
  it("ignores heartbeats and joins multiline data", () => {
    expect(parseFrame(": heartbeat")).toBeNull()
    expect(parseFrame('event: done\r\ndata: {"text":\r\ndata: "готово"}')).toEqual({
      event: "done",
      data: { text: "готово" },
    })
  })
  it("decodes split UTF-8, split CRLF frames and final authoritative text", async () => {
    const bytes = new TextEncoder().encode(
      ': heartbeat\r\n\r\nevent: text_delta\r\ndata: {"delta":"Привет"}\r\n\r\nevent: done\r\ndata: {"text":"Итог"}\r\n\r\n',
    )
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
        controller.close()
      },
    })
    const events: string[] = []
    let text = ""
    await consumeStream(stream, (event) => {
      events.push(event.event)
      if (event.event === "text_delta") text += String(event.data.delta)
      if (event.event === "done") text = String(event.data.text)
    })
    expect(events).toEqual(["text_delta", "done"])
    expect(text).toBe("Итог")
  })
  it("reports a connection that closes without a terminal event", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('event: text_delta\ndata: {"delta":"часть"}\n\n'),
        )
        controller.close()
      },
    })
    await expect(consumeStream(stream, () => {})).rejects.toThrow("stream_incomplete")
  })
  it("accepts an SSE error after HTTP success", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: error\ndata: {"code":"timeout"}\n\n'))
        controller.close()
      },
    })
    const events: string[] = []
    await consumeStream(stream, (event) => events.push(event.event))
    expect(events).toEqual(["error"])
  })
})
