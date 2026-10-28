import { ArrowUp, LoaderCircle, Mic, Square, X } from "lucide-react"
import { ru } from "@/shared/i18n/ru"
import { IconButton } from "@/shared/ui/controls"
import type { useVoiceInput } from "./use-voice-input"
import "@/shared/styles/voice.css"

type VoiceInput = ReturnType<typeof useVoiceInput>

export function VoiceButton({ voice, disabled }: { voice: VoiceInput; disabled: boolean }) {
  const recording = voice.phase === "recording"
  const waiting = voice.phase === "transcribing" || voice.phase === "requesting"
  const label = !voice.supported
    ? ru.voiceUnsupported
    : recording
      ? ru.voiceStop
      : waiting
        ? ru.voiceRecognizing
        : ru.voiceStart
  return (
    <IconButton
      label={label}
      className={`voice-button ${recording ? "recording" : ""}`}
      aria-pressed={recording}
      disabled={disabled || waiting || !voice.supported}
      onClick={() => (recording ? voice.stop() : void voice.start())}
    >
      {waiting ? (
        <LoaderCircle size={18} className="voice-spinner" />
      ) : recording ? (
        <Square size={17} />
      ) : (
        <Mic size={19} />
      )}
    </IconButton>
  )
}

export function VoiceStatus({ voice }: { voice: VoiceInput }) {
  if (!voice.error) return null
  return (
    <div className="voice-status voice-error">
      <span role="alert">{voice.error}</span>
    </div>
  )
}

export function VoiceComposer({ voice }: { voice: VoiceInput }) {
  const recording = voice.phase === "recording"
  const minutes = Math.floor(voice.seconds / 60)
  const elapsed = `${minutes}:${String(voice.seconds % 60).padStart(2, "0")}`
  const status = recording
    ? `${ru.voiceRecording} ${elapsed}`
    : voice.phase === "requesting"
      ? ru.voicePermission
      : ru.voiceRecognizing
  return (
    <fieldset className="chat-composer voice-composer" aria-label={ru.voiceStart}>
      <IconButton label={ru.voiceCancel} className="voice-cancel" onClick={voice.cancel}>
        <X size={21} />
      </IconButton>
      <div className="voice-waveform" aria-hidden="true">
        {voice.levels.map((level, index) => (
          <WaveBar key={waveKeys[index]} level={level} />
        ))}
      </div>
      <span className="voice-elapsed" aria-hidden="true">
        {recording ? elapsed : ""}
      </span>
      <span className="sr-only" role="status">
        {status}
      </span>
      <IconButton
        label={recording ? ru.voiceStop : ru.voiceRecognizing}
        className="voice-record-stop"
        onClick={voice.stop}
        disabled={!recording}
      >
        {recording ? (
          <Square size={17} fill="currentColor" />
        ) : (
          <LoaderCircle size={18} className="voice-spinner" />
        )}
      </IconButton>
      <IconButton
        label={ru.voiceFinish}
        className="send-button ready"
        onClick={voice.stop}
        disabled={!recording}
      >
        <ArrowUp size={21} />
      </IconButton>
    </fieldset>
  )
}

const waveKeys = Array.from({ length: 28 }, (_, index) => `wave-${index}`)
function WaveBar({ level }: { level: number }) {
  return (
    <span
      className="voice-wave-bar"
      style={{ transform: `scaleY(${0.12 + level * 0.88})`, opacity: 0.35 + level * 0.65 }}
    />
  )
}
