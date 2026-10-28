import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from "lucide-react"
import type { ReactNode } from "react"
import { useState } from "react"
import type { Row } from "../format"
import { cell, downloadCsv, numeric } from "../format"
import { ru } from "../i18n/ru"
import { EmptyState, IconButton } from "./controls"

export interface Column {
  key: string
  label: string
  numeric?: boolean
  format?: (value: unknown) => ReactNode
}
export function DataTable({
  rows,
  columns,
  searchable = false,
  filename = "datum.csv",
  caption,
}: {
  rows: Row[]
  columns: Column[]
  searchable?: boolean
  filename?: string
  caption?: string
}) {
  const [sort, setSort] = useState<{ key: string; asc: boolean } | null>(null)
  const [search, setSearch] = useState("")
  const filtered = rows.filter(
    (row) =>
      !search ||
      Object.values(row).some((value) =>
        cell(value).toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")),
      ),
  )
  const ordered = sort
    ? [...filtered].sort((a, b) => {
        const av = a[sort.key],
          bv = b[sort.key]
        const an = numeric(av),
          bn = numeric(bv)
        return (
          (an !== null && bn !== null ? an - bn : cell(av).localeCompare(cell(bv), "ru")) *
          (sort.asc ? 1 : -1)
        )
      })
    : filtered
  return (
    <div className="data-table-block">
      {searchable && (
        <div className="table-tools">
          <label className="search-field">
            <Search size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={ru.search}
              aria-label={ru.search}
            />
          </label>
          <IconButton label={ru.export} onClick={() => downloadCsv(ordered, filename)}>
            <Download size={16} />
          </IconButton>
        </div>
      )}
      {ordered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="table-scroll">
          <table>
            <caption className="sr-only">{caption ?? ru.results}</caption>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={col.numeric ? "numeric" : ""}
                    aria-sort={
                      sort?.key === col.key ? (sort.asc ? "ascending" : "descending") : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSort({ key: col.key, asc: sort?.key === col.key ? !sort.asc : true })
                      }
                    >
                      {col.label}
                      <SortIcon active={sort?.key === col.key} ascending={sort?.asc ?? true} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordered.map((row, i) => (
                <tr
                  key={cell(
                    row.seller_id ?? row.seller ?? row.month ?? row.state ?? row.category ?? i,
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${col.numeric ? "numeric" : ""} ${col.key.includes("seller") ? "mono-cell" : ""}`}
                      title={cell(row[col.key])}
                    >
                      {formatCell(row[col.key], col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SortIcon({ active, ascending }: { active: boolean; ascending: boolean }) {
  if (!active) return <ArrowUpDown size={12} />
  return ascending ? <ArrowUp size={12} /> : <ArrowDown size={12} />
}

function formatCell(value: unknown, column: Column): ReactNode {
  if (value === null || value === undefined) return ru.noValue
  if (column.numeric && numeric(value) === null) return ru.noValue
  return column.format ? column.format(value) : cell(value)
}
