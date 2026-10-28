import { describe, expect, it } from "vitest"
import { encodeWav } from "../src/features/chat/voice-recording"

describe("voice recording format", () => {
  it("encodes mono PCM in the format accepted by local GigaAM", async () => {
    const blob = encodeWav([Float32Array.of(-1, 0), Float32Array.of(1)], 16000)
    const buffer = await blob.arrayBuffer()
    const view = new DataView(buffer)
    expect(blob.type).toBe("audio/wav")
    expect(new TextDecoder().decode(buffer.slice(0, 4))).toBe("RIFF")
    expect(new TextDecoder().decode(buffer.slice(8, 12))).toBe("WAVE")
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(6)
    expect([44, 46, 48].map((offset) => view.getInt16(offset, true))).toEqual([-32768, 0, 32767])
  })
  it("clips microphone samples before PCM conversion", async () => {
    const view = new DataView(await encodeWav([Float32Array.of(-2, 2)], 48000).arrayBuffer())
    expect(view.getUint32(24, true)).toBe(48000)
    expect(view.getInt16(44, true)).toBe(-32768)
    expect(view.getInt16(46, true)).toBe(32767)
  })
})
