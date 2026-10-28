const metadataHeading =
  /^(?:#{1,6}\s*)?(?:\*\*)?(?:источники?|срез|фильтры|параметры|методика|sources?|filters?|scope|sql)(?:\*\*)?\s*[:：]/iu
const scopeHeading = /^(?:\*\*)?(?:срез|фильтры|scope|filters?)(?:\*\*)?\s*[:：]/iu
const quoteExample = /\s+(?=(?:Например|К примеру)[,:]\s*[\s\S]*[«“])/u

function presentBlock(block: string) {
  if (metadataHeading.test(block.trim())) {
    if (!scopeHeading.test(block.trim())) return { text: "", details: block }
    const sentences = block.split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z])/u)
    return { text: sentences.slice(1).join(" "), details: sentences[0] ?? block }
  }
  const example = quoteExample.exec(block)
  if (example)
    return {
      text: `${block.slice(0, example.index)}\n\n> ${block.slice(example.index).trim()}`,
      details: "",
    }
  return { text: block, details: "" }
}

export function presentMessage(text: string, details = "") {
  const blocks = text
    .replaceAll("\r\n", "\n")
    .split(/\n\s*\n/)
    .map(presentBlock)
  return {
    text: blocks
      .map((block) => block.text)
      .filter(Boolean)
      .join("\n\n")
      .trim(),
    details: [details, ...blocks.map((block) => block.details)].filter(Boolean).join("\n\n").trim(),
  }
}
