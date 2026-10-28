import { useEffect, useState } from "react"
import { AssistantIcon } from "@/features/chat/assistant-icon"
import { ru } from "@/shared/i18n/ru"

const STAGE_MS = 2200

export function GeneratorProgress({ prompt }: { prompt: string }) {
  const [seconds, setSeconds] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(() => {
      const ms = Date.now() - started
      setElapsed(ms)
      setSeconds(Math.floor(ms / 1000))
    }, 250)
    return () => window.clearInterval(timer)
  }, [])
  const stages = ru.genStages
  const stage = Math.min(Math.floor(elapsed / STAGE_MS), stages.length - 1)
  return (
    <div className="gen-progress" role="status" aria-live="polite">
      <span className="gen-progress-icon">
        <AssistantIcon size={30} />
      </span>
      <div className="gen-progress-body">
        <span className="gen-progress-stage" key={stage}>
          <span className="shimmer-text">{stages[stage]}</span>
        </span>
        <span className="gen-progress-prompt">{prompt}</span>
        <ol className="gen-progress-steps" aria-hidden="true">
          {stages.map((label, index) => (
            <li
              key={label}
              data-state={index < stage ? "done" : index === stage ? "active" : "idle"}
            />
          ))}
        </ol>
      </div>
      {seconds > 0 && <span className="gen-progress-time">{`${seconds} ${ru.genSeconds}`}</span>}
    </div>
  )
}
