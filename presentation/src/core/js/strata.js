;(() => {
  const kit = window.deckKit
  const N = 10
  const A = 42
  const B = 21
  const T = 34
  const PLATES = [
    { name: "raw", top: 530 },
    { name: "core", top: 390 },
    { name: "mart", top: 250 },
  ]

  const point = (top, u, v) => [500 + (u - v) * A, top + (u + v) * B]
  const poly = (pts) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]

  const cell = (top, i, j, gap) => {
    const c = point(top, i + 0.5, j + 0.5)
    return [point(top, i, j), point(top, i + 1, j), point(top, i + 1, j + 1), point(top, i, j + 1)].map((p) => lerp(p, c, gap))
  }

  window.deckStrata = (svg, { seed = 3, mode = "pixels", delay = 0 } = {}) => {
    if (svg.dataset.built) return
    svg.dataset.built = "1"
    const random = kit.rng(seed)
    PLATES.forEach((plate, index) => {
      const base = delay + index * 0.45
      const group = kit.svg("g", { class: `st-plate st-${plate.name}` }, svg)
      group.style.setProperty("--pd", `${(delay + (2 - index) * 0.12).toFixed(2)}s`)
      group.style.setProperty("--py", `${(index - 1) * -220}px`)
      const shift = (p) => [p[0], p[1] + T]
      const left = [point(plate.top, 0, N), point(plate.top, N, N), shift(point(plate.top, N, N)), shift(point(plate.top, 0, N))]
      const right = [point(plate.top, N, N), point(plate.top, N, 0), shift(point(plate.top, N, 0)), shift(point(plate.top, N, N))]
      const sideDelay = `${(base + 1.05).toFixed(2)}s`
      const l = kit.svg("polygon", { points: poly(left), class: "st-side st-left" }, group)
      const r = kit.svg("polygon", { points: poly(right), class: "st-side st-right" }, group)
      l.style.setProperty("--d", sideDelay)
      r.style.setProperty("--d", sideDelay)
      kit.svg("polygon", { points: poly([point(plate.top, 0, 0), point(plate.top, N, 0), point(plate.top, N, N), point(plate.top, 0, N)]), class: "st-under" }, group)
      for (let i = 0; i < N; i += 1) {
        for (let j = 0; j < N; j += 1) {
          const c = kit.svg("polygon", { points: poly(cell(plate.top, i, j, 0.07)), class: "st-cell" }, group)
          const light = 1 - (i + j) / (2 * N)
          c.style.setProperty("--o", (0.55 + light * 0.45 - random() * 0.12).toFixed(2))
          if (mode === "pixels") {
            const angle = random() * Math.PI * 2
            const dist = 380 + random() * 520
            c.style.setProperty("--dx", `${(Math.cos(angle) * dist).toFixed(0)}px`)
            c.style.setProperty("--dy", `${(Math.sin(angle) * dist - 260).toFixed(0)}px`)
            c.style.setProperty("--d", `${(base + random() * 0.85).toFixed(2)}s`)
          }
        }
      }
    })
    const top = PLATES[2].top
    const cx = 500
    const cy = top + N * B
    kit.svg("ellipse", { cx, cy, rx: 190, ry: 95, class: "st-glow" }, svg)
    const cube = kit.svg("g", { class: "st-cube" }, svg)
    const s = 70
    const h = 70
    const c0 = [cx, cy - 30]
    const tTop = [c0[0], c0[1] - s * 0.5]
    const tR = [c0[0] + s, c0[1]]
    const tB = [c0[0], c0[1] + s * 0.5]
    const tL = [c0[0] - s, c0[1]]
    const down = (p) => [p[0], p[1] + h]
    kit.svg("polygon", { points: poly([tL, tB, down(tB), down(tL)]), class: "st-cube-l" }, cube)
    kit.svg("polygon", { points: poly([tB, tR, down(tR), down(tB)]), class: "st-cube-r" }, cube)
    kit.svg("polygon", { points: poly([tTop, tR, tB, tL]), class: "st-cube-t" }, cube)
    cube.style.setProperty("--d", `${(delay + 2.05).toFixed(2)}s`)
    for (let k = 0; k < 3; k += 1) {
      const ring = kit.svg("ellipse", { cx, cy: cy + 10, rx: 120, ry: 60, class: "st-ring" }, svg)
      ring.style.setProperty("--d", `${(delay + 2.8 + k * 0.8).toFixed(2)}s`)
    }
    svg.classList.add(`is-${mode}`)
  }
})()
