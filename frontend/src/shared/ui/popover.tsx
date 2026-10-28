import type { ReactNode } from "react"
import { useCallback, useEffect, useId, useRef, useState } from "react"

const CLOSE_MS = 140

export function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return ref
}

export function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    const timer = window.setTimeout(() => setMounted(false), CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [open])
  return mounted
}

export function Popover({
  trigger,
  label,
  className = "",
  children,
}: {
  trigger: ReactNode
  label: string
  className?: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const mounted = usePresence(open)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  const close = useCallback(() => {
    setOpen(false)
    button.current?.focus()
  }, [])
  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, close])
  return (
    <div ref={root} className={`popover ${className}`}>
      <button
        ref={button}
        type="button"
        className="popover-trigger"
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {mounted && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className="popover-panel"
          data-state={open ? "open" : "closed"}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}
