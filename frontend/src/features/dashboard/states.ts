export const STATE_NAMES: Record<string, string> = {
  AC: "Акри",
  AL: "Алагоас",
  AM: "Амазонас",
  AP: "Амапа",
  BA: "Баия",
  CE: "Сеара",
  DF: "Федеральный округ",
  ES: "Эспириту-Санту",
  GO: "Гояс",
  MA: "Мараньян",
  MG: "Минас-Жерайс",
  MS: "Мату-Гросу-ду-Сул",
  MT: "Мату-Гросу",
  PA: "Пара",
  PB: "Параиба",
  PE: "Пернамбуку",
  PI: "Пиауи",
  PR: "Парана",
  RJ: "Рио-де-Жанейро",
  RN: "Риу-Гранди-ду-Норти",
  RO: "Рондония",
  RR: "Рорайма",
  RS: "Риу-Гранди-ду-Сул",
  SC: "Санта-Катарина",
  SE: "Сержипи",
  SP: "Сан-Паулу",
  TO: "Токантинс",
}

export function stateName(code: unknown): string {
  const key = String(code)
  return STATE_NAMES[key] ?? key
}
