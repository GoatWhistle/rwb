import { CircleHelp, MessageSquare, RefreshCw } from "lucide-react"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { useId } from "react"
import { ru } from "../i18n/ru"

export function Button({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`button ${className}`} {...props}>
      {children}
    </button>
  )
}
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Button
      {...props}
      className={`icon-button ${props.className ?? ""}`}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  )
}
export function Tip({ text, onAsk }: { text: string; onAsk?: (() => void) | undefined }) {
  const id = useId()
  return (
    <span className="tip">
      <button type="button" className="tip-trigger" aria-label={ru.more} aria-describedby={id}>
        <CircleHelp size={14} />
      </button>
      <span className="tip-content" role="tooltip" id={id}>
        {text}
        {onAsk && (
          <Button onClick={onAsk}>
            <MessageSquare size={14} />
            {ru.ask}
          </Button>
        )}
      </span>
    </span>
  )
}
export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="data-state" role="alert">
      <CircleHelp size={28} />
      <strong>{ru.error}</strong>
      <p>{ru.errorHint}</p>
      <Button onClick={retry}>
        <RefreshCw size={15} />
        {ru.retry}
      </Button>
    </div>
  )
}
export function EmptyState() {
  return (
    <div className="data-state">
      <strong>{ru.empty}</strong>
      <p>{ru.emptyHint}</p>
    </div>
  )
}
export function Skeleton() {
  return (
    <div className="loading-grid" role="status" aria-label={ru.loading}>
      <div className="skeleton metrics-skeleton" />
      <div className="skeleton chart-skeleton" />
      <div className="skeleton chart-skeleton" />
    </div>
  )
}
