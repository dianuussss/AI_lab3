# REPORT — AI code-review бот в CI

## 1. Ссылки

| Что | URL |
|-----|-----|
| Репозиторий | https://github.com/dianuussss/AI_lab3 |
| Workflow | `.github/workflows/ai-review.yml` |
| Review script | `review.js` |
| Чеклист для модели | `.github/review-instructions.md` |
| Evaluation PR | https://github.com/dianuussss/AI_lab3/pull/2 |
| Ветка | `lab/eval-v2` |
| Ground truth | `ground-truth/planted-issues.md` |
| Raw JSON прогона | `evidence/review-pr2.json` |
| Успешный run | https://github.com/dianuussss/AI_lab3/actions/runs/44368219981 |

## 2. Архитектура решения

1. Trigger: `pull_request` → `opened` / `synchronize`.
2. `actions/checkout@v4` с `fetch-depth: 0`.
3. **Three-dot diff** всего PR:
   ```bash
   git diff origin/${{ base }}...${{ github.sha }} -- . \
     ':(exclude)*.lock' ':(exclude)dist/*' ':(exclude)generated/*' ...
   ```
4. `review.js` дополнительно отфильтровывает binary / `dist` / `generated` / `*.lock`.
5. Порог: **800 строк** или **40 файлов** → комментарий «PR is too large…, review skipped», модель не вызывается.
6. В prompt уходят только: `.github/review-instructions.md` + отфильтрованный diff (не весь репозиторий).
7. Модель: Google Gemini (ListModels + fallback по flash-моделям, retry на 503) → structured JSON `{ "comments": [...] }`.
8. Результат публикуется комментарием в PR через `actions/github-script@v7`.
9. При timeout / HTTP error / битом JSON — fallback-комментарий, **exit code 0** (CI не красный).

### Почему порог 800 / 40

Контекст модели ограничен; сырой unified diff раздут. 800 строк ≈ компактный feature-PR. Mega-рефакторинги лучше ревьюить человеком / чанками. Числа зафиксированы в `review.js` (`MAX_DIFF_LINES`, `MAX_CHANGED_FILES`).

### Безопасность

- `GEMINI_API_KEY` только в GitHub Secrets → env step.
- Permissions: `contents: read`, `pull-requests: write` (минимум для checkout + comment).
- В коде/логах ключ не печатается; в post-comment есть redaction `AIza…` / `sk-…`.

## 3. Evaluation: посаженные проблемы

8 эталонных дефектов (GT-1…GT-8) + 2 false-positive bait — см. `ground-truth/planted-issues.md`.

| Категория | ID |
|-----------|-----|
| security | GT-1, GT-3 |
| bug | GT-2 |
| missing test | GT-4, GT-5 |
| stylistic | GT-7, GT-8 |
| fetch without try/catch | GT-6 |
| false-positive bait | FP-BAIT-1 (`$1` SQL), FP-BAIT-2 (fetch уже в try/catch) |

## 4. Метрики (precision / recall / FP)

Прогон: комментарий бота в [PR #2](https://github.com/dianuussss/AI_lab3/pull/2). JSON: `evidence/review-pr2.json`.

### Сопоставление с GT

| GT | Найден? | Комментарий бота |
|----|---------|------------------|
| GT-1 SQL injection | да | `src/search.js` / sql-injection |
| GT-2 null deref | да | `src/server.js` / logic-bug |
| GT-3 hardcoded secret | да | `src/server.js` / hardcoded-secret |
| GT-4 `/search` без теста | да | new-endpoint-without-test |
| GT-5 `/admin/stats` без теста | да | new-endpoint-without-test |
| GT-6 bare fetch | да | fetch-without-try-catch |
| GT-7 console.log | да | style |
| GT-8 `var` | да | style |

Доп. finding (не в GT-списке, но **валидный** по чеклисту): новый endpoint `/weather` без теста.

False-positive bait **не** сработали: параметризованный `$1` в `db.js` и `fetchJson` с try/catch не помечены.

### Результаты

Считаем относительно посаженных GT-1…GT-8. Доп. `/weather` без теста — корректное замечание по чеклисту, в FP не кладём.

| Метрика | Значение |
|---------|----------|
| Known problems (GT) | 8 |
| TP | 8 |
| FP | 0 |
| FN | 0 |
| **precision** = TP/(TP+FP) | **1.00** |
| **recall** = TP/(TP+FN) | **1.00** |
| false positives (шт.) | **0** |
| Комментариев бота всего | 9 (8 GT + `/weather` без теста) |

`node scripts/score-review.js evidence/review-pr2.json` даёт тот же recall по GT; лишний `/weather` matcher может отнести к extra — в ручном разборе это не галлюцинация.

## 5. Качество ревьюера (краткий разбор)

- Чеклист сработал: severity/reason совпали с посаженными классами проблем.
- Bait на SQL `$1` и «безопасный» fetch не вызвали галлюцинаций → хорошая precision.
- Модель даже усилила покрытие: отдельно отметила `/weather` без теста (логично по правилу «новый endpoint»).
- Надёжность: при 503/устаревших именах моделей pipeline не падал (fallback), после ListModels+retry получил валидный JSON.
- Минус процесса: зависимость от доступности Gemini free tier (были 503 high demand).

## 6. Чек-лист перед сдачей

- [x] Workflow на `opened` / `synchronize`
- [x] Ключ только в Secrets (не в коде)
- [x] Three-dot diff `base...head`
- [x] Игнор `*.lock`, `dist/`, `generated/`, binary
- [x] `review-instructions.md` существует и читается в `review.js`
- [x] Порог размера + skip
- [x] Structured JSON + fallback без падения
- [x] Комментарий в PR (workflow step)
- [x] Evaluation PR + комментарий бота: https://github.com/dianuussss/AI_lab3/pull/2
- [x] Метрики посчитаны (§4)
