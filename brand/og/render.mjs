import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createRequire } from "node:module"

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, "../../frontend/package.json"))
const { chromium } = require("playwright-core")

const source = path.join(here, "src", "og.html")
const preview = process.argv[2]
const targets = {
  "og-a": ["og.png", "../../frontend/public/og/og.png"],
  "og-b": ["variants/og-b.png"],
  "og-c": ["variants/og-c.png"],
  "og-square": ["og-square.png"],
  "og-portrait": ["og-portrait.png"],
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: process.env.CHROME_CHANNEL || "chrome" })
const shoot = async (scale, write) => {
  const page = await browser.newPage({ viewport: { width: 1300, height: 1500 }, deviceScaleFactor: scale })
  await page.goto(pathToFileURL(source).href)
  await page.evaluate(() => document.fonts.ready)
  const cards = page.locator("section.card[data-name]")
  for (let i = 0; i < (await cards.count()); i += 1) {
    const name = await cards.nth(i).getAttribute("data-name")
    await write(name, await cards.nth(i).screenshot())
  }
  await page.close()
}

await shoot(1, async (name, buffer) => {
  for (const target of targets[name] ?? []) {
    const file = path.join(here, target)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, buffer)
    console.log(path.relative(process.cwd(), file))
  }
})
if (preview) {
  fs.mkdirSync(preview, { recursive: true })
  await shoot(400 / 1200, async (name, buffer) => fs.writeFileSync(path.join(preview, `${name}-small.png`), buffer))
}
await browser.close()
