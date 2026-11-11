# Ground truth — посаженные проблемы (evaluation PR)

Ветка: `lab/eval-planted-issues`  
Файлы с дефектами: `src/server.js`, `src/search.js`

| ID | Категория | severity (ожидаемая) | Файл | Описание | reason |
|----|-----------|----------------------|------|----------|--------|
| GT-1 | security | error | `src/search.js` | SQL через конкатенацию с `name` | sql-injection / string-concat query |
| GT-2 | bug | error | `src/server.js` | `user.name.toUpperCase()` без проверки `user` на null | logic-bug |
| GT-3 | security | error | `src/server.js` | Захардкожен `INTERNAL_TOKEN = "sk-demo-secret-do-not-use"` | hardcoded-secret |
| GT-4 | missing test | warning | `src/server.js` | Новый endpoint `GET /search` без теста в `tests/` | new-endpoint-without-test |
| GT-5 | missing test | warning | `src/server.js` | Новый endpoint `GET /admin/stats` без теста | new-endpoint-without-test |
| GT-6 | bug/style-adjacent | warning | `src/server.js` | `fetch` в `/weather` без try/catch | fetch-without-try-catch |
| GT-7 | stylistic | info | `src/server.js` | `console.log("search hit", ...)` в prod-коде | style |
| GT-8 | stylistic | info | `src/search.js` | Объявление через `var q = ...` | style |

## False-positive bait (не должно ловиться)

| ID | Файл | Почему это OK |
|----|------|----------------|
| FP-BAIT-1 | `src/db.js` | Запрос `"... WHERE id = $1"` — плейсхолдер, не конкатенация с вводом |
| FP-BAIT-2 | `src/server.js` | `fetchJson` уже в try/catch — не флагать как bare fetch |

## Как считать метрики

- **TP** — комментарий бота соответствует GT-* (тот же файл + тот же класс проблемы).
- **FP** — комментарий бота не соответствует ни одному GT-* (выдумка / неверная трактовка bait).
- **FN** — GT-* без соответствующего комментария бота.
- precision = TP / (TP + FP)
- recall = TP / (TP + FN)
- false positives = FP (шт.)
