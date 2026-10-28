import { Sparkles } from "lucide-react"
import type { ReactNode } from "react"
import { ru } from "@/shared/i18n/ru"
import { Button } from "@/shared/ui/controls"
import { AssistantIcon } from "../chat/assistant-icon"

export const GENERATOR_INPUT_ID = "ctor-generator-input"

export const focusGenerator = () => {
  const input = document.getElementById(GENERATOR_INPUT_ID)
  if (!input) return
  input.scrollIntoView({ block: "center", behavior: "smooth" })
  input.focus({ preventScroll: true })
}

export function CtorEmpty({
  lead,
  accent,
  hint,
  action,
}: {
  lead: string
  accent: string
  hint: string
  action: ReactNode
}) {
  return (
    <div className="canvas-empty">
      <span className="canvas-empty-icon" aria-hidden="true">
        <AssistantIcon size={30} />
      </span>
      <h3>
        {lead} <em className="accent">{accent}</em>
      </h3>
      <p>{hint}</p>
      <div className="canvas-empty-actions">
        {action}
        <Button onClick={focusGenerator}>
          <Sparkles size={15} />
          {ru.ctorAskAgent}
        </Button>
      </div>
    </div>
  )
}
