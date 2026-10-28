import type { CSSProperties, ReactNode } from "react"
import { ru } from "@/shared/i18n/ru"
import { ErrorState } from "@/shared/ui/controls"

export interface CardQuery {
  isPending: boolean
  isError: boolean
  refetch: () => unknown
}

export function AccentTitle({ text, accent }: { text: string; accent: string }) {
  const at = text.toLowerCase().indexOf(accent.toLowerCase())
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <em className="accent-word">{text.slice(at, at + accent.length)}</em>
      {text.slice(at + accent.length)}
    </>
  )
}

export function Card({
  title,
  accent,
  description,
  actions,
  query,
  index = 0,
  className = "",
  children,
}: {
  title: string
  accent: string
  description?: string | undefined
  actions?: ReactNode
  query?: CardQuery | undefined
  index?: number | undefined
  className?: string
  children: ReactNode
}) {
  const body = query?.isError ? (
    <ErrorState retry={() => void query.refetch()} />
  ) : query?.isPending ? (
    <div className="card-skeleton" role="status" aria-label={ru.loading}>
      <span />
      <span />
      <span />
    </div>
  ) : (
    children
  )
  return (
    <section
      className={`panel dash-card ${className}`}
      style={{ "--i": index } as CSSProperties}
      aria-busy={query?.isPending || undefined}
    >
      <div className="panel-heading">
        <div>
          <h2>
            <AccentTitle text={title} accent={accent} />
          </h2>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {body}
    </section>
  )
}
