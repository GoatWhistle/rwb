import { useEffect, useState } from "react"
import { ru } from "@/shared/i18n/ru"

export function ThinkingStatus({ working }: { working: boolean }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [])
  return (
    <div className="thinking-status" role="status">
      <span className="thinking-loader" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="shimmer-text">{working ? ru.running : ru.thinking}</span>
      {seconds > 0 && <span className="thinking-time">{`${seconds} с`}</span>}
    </div>
  )
}
