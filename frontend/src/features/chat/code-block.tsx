import { Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"
import { ru } from "@/shared/i18n/ru"

type Kind = "kw" | "fn" | "str" | "num" | "com" | "par" | "key" | "lit" | "op" | "id" | "ws"
interface Token {
  kind: Kind
  text: string
}

const SQL_KEYWORDS = new Set(
  "select from where and or not as on join left right inner outer full cross group by order having limit offset with union all distinct case when then else end in is null between like ilike exists asc desc nulls first last filter over partition window interval cast true false into values insert update delete create table view using lateral returning within".split(
    " ",
  ),
)
const SQL_RULES: [Kind, RegExp][] = [
  ["com", /^--[^\n]*/],
  ["com", /^\/\*[\s\S]*?\*\//],
  ["par", /^%\(\w+\)s|^%s|^\$\d+|^:\w+/],
  ["str", /^'(?:[^']|'')*'/],
  ["id", /^"(?:[^"]|"")*"/],
  ["num", /^\d+(?:\.\d+)?/],
  ["ws", /^\s+/],
  ["op", /^(?:::|<=|>=|<>|!=|\|\||[-+*/%=<>(),.;[\]])/],
  ["id", /^[A-Za-z_][\w$]*/],
]
const JSON_RULES: [Kind, RegExp][] = [
  ["key", /^"(?:[^"\\]|\\.)*"(?=\s*:)/],
  ["str", /^"(?:[^"\\]|\\.)*"/],
  ["num", /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/],
  ["lit", /^(?:true|false|null)\b/],
  ["ws", /^\s+/],
  ["op", /^[{}[\]:,]/],
]

export function tokenize(code: string, language: "sql" | "json"): Token[] {
  const rules = language === "sql" ? SQL_RULES : JSON_RULES
  const tokens: Token[] = []
  let rest = code
  while (rest) {
    const hit = rules.map(([kind, re]) => ({ kind, match: re.exec(rest) })).find((r) => r.match)
    const text = hit?.match?.[0] ?? rest.charAt(0)
    let kind: Kind = hit?.kind ?? "op"
    if (language === "sql" && kind === "id" && !text.startsWith('"')) {
      if (SQL_KEYWORDS.has(text.toLowerCase())) kind = "kw"
      else if (/^\s*\(/.test(rest.slice(text.length))) kind = "fn"
    }
    tokens.push({ kind, text })
    rest = rest.slice(text.length)
  }
  return tokens
}

interface Line {
  no: number
  tokens: (Token & { at: number })[]
}
function lines(tokens: Token[]) {
  const out: Line[] = [{ no: 1, tokens: [] }]
  let at = 0
  for (const token of tokens) {
    token.text.split("\n").forEach((part, i) => {
      if (i > 0) out.push({ no: out.length + 1, tokens: [] })
      if (part) out[out.length - 1]?.tokens.push({ kind: token.kind, text: part, at })
      at += part.length + 1
    })
  }
  return out
}

const COLLAPSED_LINES = 12

export function CodeBlock({ code, language }: { code: string; language: "sql" | "json" }) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])
  const rows = lines(tokenize(code.trim(), language))
  const long = rows.length > COLLAPSED_LINES
  return (
    <div className="code-card">
      <div className="code-card-head">
        <span className="code-badge">{language.toUpperCase()}</span>
        <button
          type="button"
          className="code-card-action"
          onClick={() => {
            navigator.clipboard?.writeText(code).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? ru.chatCopied : ru.chatCopy}
        </button>
      </div>
      <div className={`code-card-body ${long && !open ? "is-collapsed" : ""}`}>
        <pre>
          <code>
            {rows.map((line) => (
              <span className="code-line" key={line.no}>
                <span className="code-ln" aria-hidden="true">
                  {line.no}
                </span>
                <span>
                  {line.tokens.map((token) => (
                    <span key={token.at} className={`tk-${token.kind}`}>
                      {token.text}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </code>
        </pre>
      </div>
      {long && (
        <button type="button" className="code-card-more" onClick={() => setOpen(!open)}>
          {open ? ru.chatCollapse : ru.chatExpand}
        </button>
      )}
    </div>
  )
}
