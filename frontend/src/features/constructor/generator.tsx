import { ArrowUp, CircleAlert, RefreshCw } from "lucide-react"
import { useRef, useState } from "react"
import type { Filters } from "@/shared/api/metrics"
import type { WidgetDraft, WidgetKind, WidgetSpec } from "@/shared/api/widget-types"
import { useGenerateWidget, useSaveWidget, widgetErrorCode } from "@/shared/api/widgets-generate"
import { ru } from "@/shared/i18n/ru"
import { GeneratorPreview } from "./generator-preview"
import { GeneratorProgress } from "./generator-progress"
import "@/shared/styles/constructor-generator.css"

function errorText(error: unknown): string {
  const code = widgetErrorCode(error)
  if (code.startsWith("http_5")) return ru.genErrors.unavailable ?? ""
  if (code === "http_429") return ru.genErrors.rate_limited ?? ""
  if (code === "http_408" || code === "http_504") return ru.genErrors.timeout ?? ""
  return ru.genErrors[code] ?? ru.genErrors.unknown ?? ""
}

export function WidgetGenerator({
  filters,
  onCreated,
}: {
  filters: Filters
  onCreated: (widget: WidgetSpec) => void
}) {
  const [input, setInput] = useState("")
  const [prompt, setPrompt] = useState("")
  const [draft, setDraft] = useState<WidgetDraft | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const generate = useGenerateWidget()
  const save = useSaveWidget()
  const pending = generate.isPending

  const run = (text: string) => {
    const clean = text.trim()
    if (!clean || pending) return
    setPrompt(clean)
    save.reset()
    generate.mutate(
      { prompt: clean, filters },
      { onSuccess: (response) => setDraft(response.widget) },
    )
  }

  const refine = (text: string) => run(`${prompt}\n${ru.genRefine}: ${text}`)

  const changeKind = (kind: WidgetKind) => {
    setDraft((current) => (current ? { ...current, kind } : current))
  }

  const add = () => {
    if (!draft) return
    save.mutate(draft, {
      onSuccess: (widget) => {
        onCreated(widget)
        setDraft(null)
        setInput("")
        setPrompt("")
        generate.reset()
      },
    })
  }

  const showError = generate.isError && !pending
  const showPreview = draft !== null && !pending && !generate.isError

  return (
    <section className="gen" aria-label={ru.genSubmit}>
      <form
        className="gen-prompt"
        data-busy={pending}
        onSubmit={(event) => {
          event.preventDefault()
          run(input)
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          maxLength={2000}
          disabled={pending}
          onChange={(event) => setInput(event.target.value)}
          placeholder={ru.genPlaceholder}
          aria-label={ru.genPlaceholder}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              run(input)
            }
          }}
        />
        <button
          type="submit"
          className={`gen-send ${input.trim() && !pending ? "ready" : ""}`}
          aria-label={ru.genSubmit}
          title={ru.genSubmit}
          disabled={pending || !input.trim()}
        >
          <ArrowUp size={21} />
        </button>
      </form>
      <ul className="gen-examples" aria-label={ru.genExamplesLabel}>
        {ru.genExamples.map((example) => (
          <li key={example}>
            <button
              type="button"
              className="gen-chip"
              disabled={pending}
              onClick={() => {
                setInput(example)
                run(example)
              }}
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
      <div className="gen-stage" aria-live="polite">
        {pending && <GeneratorProgress prompt={prompt} />}
        {showError && (
          <div className="gen-error" role="alert">
            <CircleAlert size={20} className="gen-error-icon" aria-hidden="true" />
            <div className="gen-error-body">
              <strong>{ru.genErrorTitle}</strong>
              <p>{errorText(generate.error)}</p>
            </div>
            <button type="button" className="gen-btn gen-btn-ghost" onClick={() => run(prompt)}>
              <RefreshCw size={16} aria-hidden="true" />
              {ru.genRetry}
            </button>
          </div>
        )}
        {showPreview && (
          <>
            {save.isError && (
              <div className="gen-error gen-error-inline" role="alert">
                <CircleAlert size={20} className="gen-error-icon" aria-hidden="true" />
                <div className="gen-error-body">
                  <strong>{ru.genSaveErrorTitle}</strong>
                  <p>{errorText(save.error)}</p>
                </div>
                <button type="button" className="gen-btn gen-btn-ghost" onClick={add}>
                  <RefreshCw size={16} aria-hidden="true" />
                  {ru.genRetry}
                </button>
              </div>
            )}
            <GeneratorPreview
              draft={draft}
              saving={save.isPending}
              busy={pending}
              onKind={changeKind}
              onSave={add}
              onRedo={() => run(prompt)}
              onRefine={refine}
            />
          </>
        )}
      </div>
    </section>
  )
}
