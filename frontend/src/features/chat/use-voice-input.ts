import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { SpeechError, speechStatus, transcribeAudio } from "@/shared/api/voice"
import { ru } from "@/shared/i18n/ru"
import { VoiceRecording } from "./voice-recording"

export type VoicePhase = "idle" | "requesting" | "recording" | "transcribing"

function errorText(error: unknown) {
  if (error instanceof SpeechError && error.code in ru.voiceErrors)
    return ru.voiceErrors[error.code as keyof typeof ru.voiceErrors]
  if (error instanceof DOMException) {
    if (["NotAllowedError", "SecurityError"].includes(error.name))
      return ru.voiceErrors.permission_denied
    if (["NotFoundError", "NotReadableError"].includes(error.name))
      return ru.voiceErrors.microphone_unavailable
  }
  return ru.voiceErrors.speech_unavailable
}

export function useVoiceInput(active: boolean, onText: (text: string) => void) {
  const client = useQueryClient()
  const [phase, setPhase] = useState<VoicePhase>("idle")
  const [error, setError] = useState("")
  const [seconds, setSeconds] = useState(0)
  const [levels, setLevels] = useState<number[]>(Array(28).fill(0))
  const recorder = useRef<VoiceRecording | null>(null)
  const controller = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const onTextRef = useRef(onText)
  onTextRef.current = onText
  const supported =
    typeof window !== "undefined" &&
    window.isSecureContext &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    "AudioWorkletNode" in window

  const recognition = useMutation({
    retry: false,
    mutationFn: ({ blob, signal }: { blob: Blob; signal: AbortSignal; id: number }) =>
      transcribeAudio(blob, signal),
    onSuccess: (result, { id }) => {
      if (generation.current === id) onTextRef.current(result.text)
    },
    onError: (failure, { id }) => {
      if (generation.current === id) setError(errorText(failure))
    },
    onSettled: (_, __, { id }) => {
      if (generation.current !== id) return
      controller.current = null
      setPhase("idle")
    },
  })

  const cancel = useCallback(() => {
    generation.current++
    recorder.current?.cancel()
    recorder.current = null
    controller.current?.abort()
    controller.current = null
    setPhase("idle")
  }, [])

  const stop = () => {
    const recording = recorder.current
    if (!recording) return
    recorder.current = null
    const blob = recording.stop()
    controller.current = new AbortController()
    setPhase("transcribing")
    recognition.mutate({ blob, signal: controller.current.signal, id: generation.current })
  }

  const markRecording = (id: number) => {
    if (generation.current === id) setPhase("recording")
  }

  const start = async () => {
    if (!supported || recorder.current || controller.current) return
    setError("")
    setSeconds(0)
    setLevels(Array(28).fill(0))
    setPhase("requesting")
    const id = ++generation.current
    const recording = new VoiceRecording()
    recorder.current = recording
    try {
      const status = await client.fetchQuery({
        queryKey: ["voice-status"],
        queryFn: ({ signal }) => speechStatus(signal),
        staleTime: 30000,
      })
      if (generation.current !== id) return
      if (!status.available) throw new SpeechError("speech_unavailable")
      if (
        await recording.start(stop, (level) => setLevels((current) => [...current.slice(1), level]))
      )
        markRecording(id)
    } catch (failure) {
      recording.cancel()
      if (generation.current !== id) return
      recorder.current = null
      setError(errorText(failure))
      setPhase("idle")
    }
  }

  useEffect(() => {
    if (!active) cancel()
  }, [active, cancel])
  useEffect(
    () => () => {
      generation.current++
      recorder.current?.cancel()
      controller.current?.abort()
    },
    [],
  )
  useEffect(() => {
    if (phase !== "recording") return
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [phase])
  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(""), 6000)
    return () => window.clearTimeout(timer)
  }, [error])
  const dismiss = useCallback(() => setError(""), [])
  return {
    phase,
    error,
    dismiss,
    seconds,
    levels,
    supported,
    start,
    stop,
    cancel,
    busy: phase !== "idle",
  }
}
