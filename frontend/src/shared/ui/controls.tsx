import { CircleAlert, MessageSquare, RefreshCw } from "lucide-react"
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react"
import { useId } from "react"
import { ru } from "../i18n/ru"
import "../styles/controls.css"

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
export function HintLabel({
  label,
  text,
  onAsk,
  className = "",
}: {
  label: ReactNode
  text: string
  onAsk?: (() => void) | undefined
  className?: string
}) {
  const id = useId()
  return (
    <span className={`hint ${className}`}>
      <button type="button" className="hint-trigger" aria-describedby={id}>
        {label}
      </button>
      <span className="hint-pop" role="tooltip" id={id}>
        <span className="hint-text">{text}</span>
        {onAsk && (
          <button type="button" className="hint-ask" onClick={onAsk}>
            <MessageSquare size={14} aria-hidden="true" />
            {ru.ask}
          </button>
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
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T) => void
  label: string
}) {
  const index = options.findIndex((o) => o.value === value)
  return (
    <fieldset
      className="segmented-control"
      style={{ "--count": options.length, "--index": Math.max(index, 0) } as CSSProperties}
    >
      <legend className="sr-only">{label}</legend>
      <span className="segmented-indicator" data-hidden={index < 0} aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          className="segmented-option"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  )
}
function StateHeading({ text, accent }: { text: string; accent?: string | undefined }) {
  if (!accent || !text.includes(accent)) return <strong className="data-state-title">{text}</strong>
  const [before, after] = text.split(accent)
  return (
    <strong className="data-state-title">
      {before}
      <em>{accent}</em>
      {after}
    </strong>
  )
}
export function ErrorState({ retry, accent }: { retry: () => void; accent?: string }) {
  return (
    <div className="data-state" role="alert">
      <CircleAlert size={48} strokeWidth={1.5} className="data-state-icon" aria-hidden="true" />
      <StateHeading text={ru.error} accent={accent} />
      <p>{ru.errorHint}</p>
      <Button className="primary" onClick={retry}>
        <RefreshCw size={15} />
        {ru.retry}
      </Button>
    </div>
  )
}
export function EmptyState({ accent }: { accent?: string }) {
  return (
    <div className="data-state">
      <span className="data-state-icon data-state-empty" aria-hidden="true" />
      <StateHeading text={ru.empty} accent={accent} />
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
