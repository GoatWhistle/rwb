import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Message } from "../src/features/chat/message"
import { presentMessage } from "../src/features/chat/message-presentation"
import type { ChatMessage } from "../src/features/chat/use-chat"

describe("readable chat answers", () => {
  it("keeps the requested example visible and folds technical references", () => {
    const raw =
      "Да, встречались отзывы с грубой бранью на португальском. Например, «UMA MERDA» — перевод: «Полное дерьмо»; покупателю пришёл другой товар.\n\nИсточник: review_id 48013e83df6108633793311cdaeda6ed, заказ 4f4713c9b445b523bc53cb7a472b7a99.\n\nСрез: заказы за 01.09.2016–01.09.2018, без ограничений по штатам, продавцам и категориям. Это подтверждённый пример, а не подсчёт всех отзывов с матом."
    const result = presentMessage(raw)
    expect(result.text).toBe(
      "Да, встречались отзывы с грубой бранью на португальском.\n\n> Например, «UMA MERDA» — перевод: «Полное дерьмо»; покупателю пришёл другой товар.\n\nЭто подтверждённый пример, а не подсчёт всех отзывов с матом.",
    )
    expect(result.text).toContain("UMA MERDA")
    expect(result.details).not.toContain("UMA MERDA")
    expect(result.details).toContain("48013e83df6108633793311cdaeda6ed")
    expect(result.details).toContain("01.09.2016")
  })

  it("keeps business definitions and an explicitly requested ID in the answer", () => {
    const text =
      "Показатель «Средний чек» включает доставку.\n\nID нужного заказа: 4f4713c9b445b523bc53cb7a472b7a99."
    expect(presentMessage(text)).toEqual({ text, details: "" })
  })

  it("keeps Markdown quotations visible alongside structured details", () => {
    expect(
      presentMessage("Найден пример.\n\n> Товар пришёл другим.", "Проверено по отзыву."),
    ).toEqual({ text: "Найден пример.\n\n> Товар пришёл другим.", details: "Проверено по отзыву." })
  })

  it("renders the example in the answer and one closed disclosure for references", () => {
    const message: ChatMessage = {
      id: "answer",
      role: "assistant",
      text: "Найден пример.\n\n> UMA MERDA\n\nПеревод: полное дерьмо.",
      details: "Срез: исторические данные.",
      charts: [],
      sources: [{ type: "review", review_id: "review-1", order_id: "order-1" }],
      tables: {
        reviews: {
          columns: [{ name: "review_id" }],
          rows: [{ review_id: "review-1" }],
          truncated: false,
        },
      },
    }
    const html = renderToStaticMarkup(createElement(Message, { message }))
    expect(html).toContain('<details class="message-details">')
    expect(html).not.toMatch(/<details[^>]*\bopen/)
    const answer = html.match(/<div class="answer-prose">([\s\S]*?)<\/div>/)?.[1]
    expect(answer).toContain("Найден пример.")
    expect(answer).toContain("<blockquote>")
    expect(answer).toContain("UMA MERDA")
    expect(answer).toContain("Перевод")
    expect(answer).not.toContain("Срез")
    expect(answer).not.toContain("review-1")
  })
})
