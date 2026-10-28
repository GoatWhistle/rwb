import { percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { EmptyState, Panel } from "@/shared/ui/controls"

export function CustomerProfile({ returnedPct }: { returnedPct: number | null }) {
  return (
    <Panel title={ru.customerProfile} description={ru.customerProfileNote}>
      {returnedPct === null ? (
        <EmptyState />
      ) : (
        <>
          <div className="retention-bar">
            <div style={{ width: `${100 - returnedPct}%` }} />
            <div style={{ width: `${returnedPct}%` }} />
          </div>
          <div className="retention-legend">
            <span>
              <i />
              {ru.single}
              <strong>{percent(1 - returnedPct / 100, 2)}</strong>
            </span>
            <span>
              <i />
              {ru.multiple}
              <strong>{percent(returnedPct / 100, 2)}</strong>
            </span>
          </div>
          <p className="footnote">{ru.customerFootnote}</p>
        </>
      )}
    </Panel>
  )
}
