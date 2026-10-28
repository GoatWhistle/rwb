import type { Row } from "@/shared/format"
import { number, percent } from "@/shared/format"
import { ru } from "@/shared/i18n/ru"
import { EmptyState, Panel } from "@/shared/ui/controls"
import { HBars } from "./bars"
import { stateName } from "./states"
import "@/shared/styles/delivery-customers.css"

export function CustomerProfile({
  returnedPct,
  states = [],
}: {
  returnedPct: number | null
  states?: Row[]
}) {
  return (
    <div className="customers-grid">
      <Panel title={ru.customerProfile} description={ru.customerProfileNote}>
        {returnedPct === null ? (
          <EmptyState />
        ) : (
          <>
            <div className="retention-hero">
              <strong>{percent(returnedPct / 100, 2)}</strong>
              <span>покупателей вернулись за повторной покупкой</span>
            </div>
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
      <Panel title="Где живут покупатели" description="Доставленные заказы по штатам, топ-10">
        <HBars
          rows={states}
          label={(row) => stateName(row.state)}
          sublabel={(row) => String(row.state)}
          value="delivered"
          format={(n) => number(n)}
        />
      </Panel>
    </div>
  )
}
