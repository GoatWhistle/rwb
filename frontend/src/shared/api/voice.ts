import type { components } from "./schema.gen"

export type SpeechStatus = components["schemas"]["SpeechStatus"]
export type Transcription = components["schemas"]["Transcription"]

export class SpeechError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

export async function speechStatus(signal: AbortSignal): Promise<SpeechStatus> {
  const response = await fetch("/api/audio/health", { signal })
  if (!response.ok) throw new SpeechError("speech_unavailable")
  return response.json()
}

export async function transcribeAudio(blob: Blob, signal: AbortSignal): Promise<Transcription> {
  const response = await fetch("/api/audio/transcribe", {
    method: "POST",
    headers: { "Content-Type": "audio/wav" },
    body: blob,
    signal,
  })
  const body = await response.json()
  if (!response.ok)
    throw new SpeechError(
      typeof body.detail?.code === "string" ? body.detail.code : "speech_unavailable",
    )
  if (typeof body.text !== "string" || !body.text.trim())
    throw new SpeechError("speech_not_detected")
  return body
}
