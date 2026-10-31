const root = document.documentElement
root.classList.add("js")

const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add("is-in")
      revealObserver.unobserve(entry.target)
    }
  },
  { rootMargin: "0px 0px -10% 0px" },
)

for (const el of document.querySelectorAll("[data-reveal]")) revealObserver.observe(el)

const links = new Map(
  [...document.querySelectorAll(".nav a")].map((a) => [a.getAttribute("href").slice(1), a]),
)

const spy = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      for (const a of links.values()) a.removeAttribute("aria-current")
      links.get(entry.target.id)?.setAttribute("aria-current", "true")
    }
  },
  { rootMargin: "-30% 0px -60% 0px" },
)

for (const id of links.keys()) {
  const section = document.getElementById(id)
  if (section) spy.observe(section)
}

for (const button of document.querySelectorAll("[data-replay]")) {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.replay)
    if (!target) return
    target.classList.remove("play")
    void target.offsetWidth
    target.classList.add("play")
  })
}

for (const group of document.querySelectorAll("[data-segmented]")) {
  const indicator = group.querySelector(".segmented__indicator")
  const buttons = [...group.querySelectorAll("button")]
  const output = document.getElementById(group.dataset.segmented)

  const place = (button, animate) => {
    if (!animate) indicator.style.transition = "none"
    indicator.style.inlineSize = `${button.offsetWidth}px`
    indicator.style.translate = `${button.offsetLeft}px 0`
    if (!animate) requestAnimationFrame(() => indicator.style.removeProperty("transition"))
  }

  const select = (button, animate) => {
    for (const b of buttons) b.setAttribute("aria-pressed", String(b === button))
    place(button, animate)
    if (!output) return
    output.textContent = button.dataset.value
    output.classList.remove("swap-in")
    void output.offsetWidth
    output.classList.add("swap-in")
  }

  for (const button of buttons) button.addEventListener("click", () => select(button, true))
  const initial = buttons.find((b) => b.getAttribute("aria-pressed") === "true") ?? buttons[0]
  document.fonts.ready.then(() => place(initial, false))
  new ResizeObserver(() => {
    const active = buttons.find((b) => b.getAttribute("aria-pressed") === "true")
    if (active) place(active, false)
  }).observe(group)
}

for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", () => {
    const text = button.dataset.copy
    navigator.clipboard?.writeText(text).then(() => {
      const label = button.textContent
      button.textContent = "Скопировано"
      setTimeout(() => {
        button.textContent = label
      }, 1200)
    })
  })
}
