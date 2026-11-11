# Lab 3 — AI code-review бот в CI

Свой pipeline (не готовый Action): GitHub Actions читает **three-dot diff** PR, вызывает OpenAI (`gpt-4o-mini`) по чеклисту `.github/review-instructions.md` и публикует комментарий в PR.

## Что внутри

| Файл | Назначение |
|------|------------|
| `.github/workflows/ai-review.yml` | trigger `opened`/`synchronize`, minimal permissions, three-dot diff, post comment |
| `review.js` | фильтр lock/dist/generated/binary, порог размера, structured JSON, fallback без падения CI |
| `.github/review-instructions.md` | конкретный чеклист severity/правил для модели |
| `src/` | демо-сервис для evaluation PR |
| `ground-truth/planted-issues.md` | эталон посаженных проблем |
| `REPORT.md` | precision / recall / FP и разбор качества |

## Secrets

Repository → **Settings → Secrets and variables → Actions → New repository secret**:

- Name: `OPENAI_API_KEY`
- Value: ключ OpenAI с https://platform.openai.com/api-keys

Ключ **не** кладётся в код и не печатается в логах. Cursor для CI не подходит — нужен именно API-ключ OpenAI.

## Локальный прогон review

```bash
export OPENAI_API_KEY=...
git diff main...HEAD -- . ':(exclude)*.lock' ':(exclude)dist/*' ':(exclude)generated/*' > diff.txt
node review.js diff.txt
```

## Evaluation PR

Ветка `lab/eval-planted-issues` содержит заведомо плохой код под чеклист. После пуша CI оставит комментарий — по нему считаются метрики в `REPORT.md`.
