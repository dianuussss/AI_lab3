# REPORT — AI code-review бот в CI

## 1. Ссылки

| Что | URL |
|-----|-----|
| Репозиторий | https://github.com/dianuussss/AI_lab3 |
| Workflow | `.github/workflows/ai-review.yml` |
| Review script | `review.js` |
| Чеклист для модели | `.github/review-instructions.md` |
| Evaluation PR | *(заполнить после пуша)* `lab/eval-planted-issues` |
| Ground truth | `ground-truth/planted-issues.md` |

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
7. Модель (OpenAI `gpt-4o-mini`) должна вернуть structured JSON `{ "comments": [...] }`.
8. Результат публикуется комментарием в PR через `actions/github-script@v7`.
9. При timeout / HTTP error / битом JSON — fallback-комментарий, **exit code 0** (CI не красный).

### Почему порог 800 / 40

Контекст модели ограничен; сырой unified diff раздут. 800 строк ≈ компактный feature-PR. Mega-рефакторинги лучше ревьюить человеком / чанками. Числа зафиксированы в `review.js` (`MAX_DIFF_LINES`, `MAX_CHANGED_FILES`).

### Безопасность

- `OPENAI_API_KEY` только в GitHub Secrets → env step.
- Permissions: `contents: read`, `pull-requests: write` (минимум для checkout + comment).
- В коде/логах ключ не печатается; в post-comment есть redaction `sk-ant-…`.

## 3. Evaluation: посаженные проблемы

8 эталонных дефектов (GT-1…GT-8) + 2 false-positive bait — см. `ground-truth/planted-issues.md`.

Категории по заданию:

| Категория | ID |
|-----------|-----|
| security | GT-1, GT-3 |
| bug | GT-2 |
| missing test | GT-4, GT-5 |
| stylistic | GT-7, GT-8 |
| fetch without try/catch | GT-6 |
| false-positive bait | FP-BAIT-1 (`$1` SQL), FP-BAIT-2 (fetch уже в try/catch) |

## 4. Метрики (precision / recall / FP)

После того как бот оставит комментарий на evaluation PR:

```bash
# скачать JSON из артефакта / скопировать Raw JSON из комментария в review.json
node scripts/score-review.js review.json
```

### Результаты прогона

| Метрика | Значение |
|---------|----------|
| Known problems (GT) | 8 |
| TP | _TBD после CI_ |
| FP | _TBD_ |
| FN | _TBD_ |
| **precision** = TP/(TP+FP) | _TBD_ |
| **recall** = TP/(TP+FN) | _TBD_ |
| false positives (шт.) | _TBD_ |

Таблица заполняется после первого успешного прогона с валидным `OPENAI_API_KEY`.

## 5. Качество ревьюера (краткий разбор)

Ожидаемое поведение при конкретном чеклисте:

- **Сильные стороны:** узкий чеклист с явными severity и `reason` снижает «ревью вообще»; bait с `$1` проверяет, галлюцинирует ли бот SQL injection.
- **Риски recall:** два новых endpoint (GT-4/GT-5) модель может схлопнуть в один комментарий «нет тестов» — в скоринге это может дать 1 TP + 1 FN, если матчер ждёт оба пути.
- **Риски precision:** стилистика (`console.log`, `var`) иногда игнорируется «как мелочь»; наоборот, параметризованный SQL в `db.js` — классический FP, если инструкции не дошли до prompt.
- **Надёжность pipeline:** даже при мусоре от модели PR получает fallback-комментарий и workflow остаётся зелёным.

## 6. Чек-лист перед сдачей

- [x] Workflow на `opened` / `synchronize`
- [x] Ключ только в Secrets (не в коде)
- [x] Three-dot diff `base...head`
- [x] Игнор `*.lock`, `dist/`, `generated/`, binary
- [x] `review-instructions.md` существует и читается в `review.js`
- [x] Порог размера + skip
- [x] Structured JSON + fallback без падения
- [x] Комментарий в PR (workflow step)
- [ ] Evaluation PR запушен + комментарий бота получен
- [ ] Метрики посчитаны и вписаны в §4
