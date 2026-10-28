import { useMutation } from "@tanstack/react-query"
import type { Filters } from "./metrics"
import type {
  WidgetDraft,
  WidgetGenerateRequest,
  WidgetGenerateResponse,
  WidgetSpec,
} from "./widget-types"

export class WidgetApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new WidgetApiError("network")
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { code?: unknown } | null
    const code = typeof payload?.code === "string" ? payload.code : `http_${response.status}`
    throw new WidgetApiError(code)
  }
  return (await response.json()) as T
}

export function generateWidget(request: WidgetGenerateRequest): Promise<WidgetGenerateResponse> {
  return postJson<WidgetGenerateResponse>("/api/widgets/generate", request)
}

export function saveWidget(draft: WidgetDraft): Promise<WidgetSpec> {
  return postJson<WidgetSpec>("/api/widgets", draft)
}

export function useGenerateWidget() {
  return useMutation({
    mutationFn: ({ prompt, filters }: { prompt: string; filters: Filters }) =>
      generateWidget({ prompt, filters }),
  })
}

export function useSaveWidget() {
  return useMutation({ mutationFn: saveWidget })
}

export function widgetErrorCode(error: unknown): string {
  return error instanceof WidgetApiError ? error.code : "unknown"
}
