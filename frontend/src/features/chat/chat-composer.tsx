import { ArrowUp, Plus, Square } from "lucide-react"
import type { RefObject } from "react"
import { ru } from "@/shared/i18n/ru"
import { IconButton } from "@/shared/ui/controls"
import type { useVoiceInput } from "./use-voice-input"
import { VoiceButton, VoiceComposer, VoiceStatus } from "./voice-controls"

export function ChatComposer({
  input,
  onInput,
  inputRef,
  pending,
  onSend,
  onStop,
  onReset,
  voice,
}: {
  input: string
  onInput: (text: string) => void
  inputRef: RefObject<HTMLTextAreaElement | null>
  pending: boolean
  onSend: () => void
  onStop: () => void
  onReset: () => void
  voice: ReturnType<typeof useVoiceInput>
}) {
  if (voice.busy) return <VoiceComposer voice={voice} />
  return (
    <>
      <VoiceStatus voice={voice} />
      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault()
          onSend()
        }}
      >
        <IconButton label={ru.newChat} onClick={onReset} disabled={pending}>
          <Plus size={21} />
        </IconButton>
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          maxLength={20000}
          onChange={(event) => onInput(event.target.value)}
          placeholder={ru.placeholder}
          aria-label={ru.placeholder}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              onSend()
            }
          }}
        />
        <VoiceButton voice={voice} disabled={pending} />
        <IconButton
          label={pending ? ru.stop : ru.send}
          className={`send-button ${input.trim() || pending ? "ready" : ""}`}
          onClick={pending ? onStop : onSend}
          disabled={!pending && !input.trim()}
        >
          {pending ? <Square size={17} /> : <ArrowUp size={21} />}
        </IconButton>
      </form>
    </>
  )
}
