import type { ReactNode } from "react"
import { ConstructorIcon } from "./constructor-icon"

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
        <ConstructorIcon size={30} />
      </span>
      <h3>
        {lead} <em className="accent">{accent}</em>
      </h3>
      <p>{hint}</p>
      <div className="canvas-empty-actions">{action}</div>
    </div>
  )
}
