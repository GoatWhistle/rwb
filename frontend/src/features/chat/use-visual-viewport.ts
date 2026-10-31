import { useEffect } from "react"

const MOBILE = "(max-width: 768px)"

export function useVisualViewport(active: boolean) {
  useEffect(() => {
    const viewport = window.visualViewport
    const root = document.documentElement
    if (!active || !viewport) return
    const media = window.matchMedia(MOBILE)
    let frame = 0
    const clear = () => {
      root.style.removeProperty("--chat-vv-height")
      root.style.removeProperty("--chat-vv-top")
    }
    const apply = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!media.matches) return clear()
        root.style.setProperty("--chat-vv-height", `${Math.round(viewport.height)}px`)
        root.style.setProperty("--chat-vv-top", `${Math.round(viewport.offsetTop)}px`)
      })
    }
    apply()
    viewport.addEventListener("resize", apply)
    viewport.addEventListener("scroll", apply)
    media.addEventListener("change", apply)
    return () => {
      cancelAnimationFrame(frame)
      viewport.removeEventListener("resize", apply)
      viewport.removeEventListener("scroll", apply)
      media.removeEventListener("change", apply)
      clear()
    }
  }, [active])
}
