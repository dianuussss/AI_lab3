# Checklist для AI code-review бота

Проверяй **только** diff PR по правилам ниже. Не выдумывай проблемы вне этого списка.
Каждый найденный пункт оформляй отдельным комментарием со severity из таблицы.

## Обязательные проверки

| # | Правило | severity | Что писать в `reason` |
|---|---------|----------|------------------------|
| 1 | SQL-запрос собран через конкатенацию строк / template literals с пользовательским вводом (риск SQL injection) | `error` | sql-injection / string-concat query |
| 2 | HTTP-вызов `fetch` / `axios` / `http.get` без `try/catch` (или без `.catch` у promise) в async-коде | `warning` | fetch-without-try-catch |
| 3 | Новый HTTP endpoint / route добавлен в `src/`, но в diff нет соответствующего теста в `tests/` | `warning` | new-endpoint-without-test |
| 4 | Явный bug: использование значения до проверки на `null`/`undefined`, деление на ноль, off-by-one в циклах/срезах, сравнение с `=` вместо `===` в условии | `error` | logic-bug |
| 5 | Секреты / API keys / пароли захардкожены в коде (строковые литералы, не `process.env`) | `error` | hardcoded-secret |
| 6 | Стилистика продакшн-кода: `console.log` / `console.debug` в `src/` (не в тестах), или объявление через `var` | `info` | style |

## Что НЕ считать проблемой (false-positive bait)

- Параметризованные SQL-запросы (`$1`, `?`, prepared statements, query builder с плейсхолдерами) — даже если рядом есть строка с SQL-ключевыми словами.
- `fetch` внутри функции, которая уже обёрнута в `try/catch` на уровень выше в том же блоке diff.
- Логирование через переданный `logger` / `debug` библиотеку — это не `console.log`.
- Изменения только в markdown / конфигах CI / `review-instructions.md` — не ревьюить как код.

## Формат ответа

Верни **только** JSON (без markdown-обёртки):

```json
{
  "comments": [
    {
      "file": "path/to/file.js",
      "severity": "error|warning|info",
      "message": "коротко что не так и как исправить",
      "reason": "код правила из таблицы выше"
    }
  ]
}
```

Если по чеклисту замечаний нет — верни `{ "comments": [] }`.
Не добавляй поля вне схемы. Не дублируй один и тот же finding.
