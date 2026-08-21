# [АРХИВ] Руководство по интеграции учебных материалов (Content Ingestion Manual v1)

**Версия:** 1.0 (Preprod Release)
**Проект:** Образовательная платформа Zhangak
**Целевой контур:** Node.js API (:3210) + PostgreSQL 16 + Private Object Storage + Next.js BFF (:3200)

---

## 1. Архитектурный обзор preprod-контура Zhangak

В текущей версии preprod реализована строгая многодоменная архитектура с изоляцией данных и нулевым доверием к клиенту:

```text
Пользователь (Браузер / PWA / Expo Mobile)
    │
    ├── HTTPS (TLS Terminated by Nginx)
    ▼
Next.js BFF & Multi-Host Proxy (:3200)
    │
    ├── Loopback Only (/v1/*)
    ▼
Zhangak Node API (:3210)
    │
    ├── 1. PostgreSQL (:5433, private) ── [11 миграций, строгие CHECK-констрейнты]
    ├── 2. Private Storage Root ───────── [/mnt/HC_Volume_.../zhangak-materials]
    └── 3. AI Provider (LLM API) ─────── [Серверный контур, feature-flagged]
```

### Ключевые инварианты данных:
1. **Вопросы и варианты ответов (`practice_questions`)**:
   - Строгий формат JSONB: ровно 4 ключа `{"a": "...", "b": "...", "c": "...", "d": "..."}`.
   - `correct_answer` ограничен `('a', 'b', 'c', 'd')`.
   - Ответы **никогда** не отдаются клиенту до сабмита попытки.
2. **Материалы уроков (`lesson_materials`)**:
   - Четыре типа: `rich_text` (LaTeX/Markdown), `video` (YouTube URL), `document` (PDF до 200 MiB), `image` (PNG/JPEG/WebP до 30 MiB).
   - Бинарные файлы хранятся **только** в `ZHANGAK_STORAGE_ROOT` под непрозрачным ключом `lesson/{lessonId}/{uuid}`.
   - Статус сканирования: `pending` -> `clean` (только `clean` доступен ученику с активным зачислением).
3. **Безопасность и PII**:
   - Папка `06_chat_exports_and_history` **заблокирована для импорта** (содержит персональные данные и сырую переписку).

---

## 2. Пошаговый план внедрения материалов

### Шаг 1. Подготовка инфраструктуры и хранилища
1. Убедитесь, что на сервере создан приватный каталог хранилища с правами пользователя API:
   ```bash
   install -d -o zhangak-api -g zhangak-api -m 0750 /mnt/HC_Volume_106608581/zhangak-materials
   ```
2. В файле `/etc/zhangak-api/zhangak-api.env` должна быть указана переменная:
   ```ini
   ZHANGAK_STORAGE_ROOT=/mnt/HC_Volume_106608581/zhangak-materials
   ```

### Шаг 2. Разрешение проблемы с 5-м вариантом ответов (A-E vs A-D)
В материалах Telegram по математике часто присутствует вариант "Д / E".
Выберите одну из двух стратегий:

* **Вариант А (Рекомендуемый для соответствия ОРТ): Расширение схемы БД до A-E**:
  Применить миграцию `012_support_five_options.sql`:
  ```sql
  ALTER TABLE practice_questions DROP CONSTRAINT practice_questions_options_shape;
  ALTER TABLE practice_questions ADD CONSTRAINT practice_questions_options_shape CHECK (
    jsonb_typeof(options) = 'object'
    AND (
      (options ?& ARRAY['a', 'b', 'c', 'd']::text[] AND options - ARRAY['a', 'b', 'c', 'd']::text[] = '{}'::jsonb)
      OR
      (options ?& ARRAY['a', 'b', 'c', 'd', 'e']::text[] AND options - ARRAY['a', 'b', 'c', 'd', 'e']::text[] = '{}'::jsonb)
    )
  );
  ALTER TABLE practice_questions DROP CONSTRAINT practice_questions_correct_answer;
  ALTER TABLE practice_questions ADD CONSTRAINT practice_questions_correct_answer CHECK (correct_answer IN ('a', 'b', 'c', 'd', 'e'));
  ```
  И обновить константу в `backend/src/routes/platform-learning.js`: `const ANSWERS = new Set(['a', 'b', 'c', 'd', 'e'])`.

* **Вариант Б: Методическая адаптация**:
  Скрипт импорта фильтрует или адаптирует 5-й вариант под 4 варианта (A-D), либо помечает такие вопросы как `is_active = false` (черновик для доработки методистом).

---

### Шаг 3. Импорт структурированных тестов с ответами
Готовые банки тестов (`245 аналогия жообу менен.docx`, `240_суроо_кыргыз_прг_жообу_менен_2.docx`, `Катыш.pdf`) загружаются через транзакционный скрипт:

1. Создается тест в `practice_tests`:
   ```sql
   INSERT INTO practice_tests (course_id, lesson_id, title, subject, test_type, pass_score_ratio, is_published)
   VALUES ($1, $2, 'Аналогиялар: 1-бөлүк (245 суроо)', 'Кыргыз тили', 'practice', 0.75, true)
   RETURNING id;
   ```
2. Для каждого вопроса выполняется парсинг текста и вариантов в JSONB:
   ```sql
   INSERT INTO practice_questions (
     practice_test_id, position, question_text, options, correct_answer, explanation, is_active
   ) VALUES (
     $1, $2, $3, $4::jsonb, $5, $6, true
   );
   ```

---

### Шаг 4. Импорт PDF/DOCX и изображений в `lesson_materials`
Для каждого обучающего документа:
1. Вычисляется `SHA-256` хэш и валидируется размер/сигнатура (PDF / PNG / WebP).
2. Файл копируется в `$ZHANGAK_STORAGE_ROOT/lesson/{lessonId}/{uuid}`.
3. В таблицу `lesson_materials` вставляется запись:
   ```sql
   INSERT INTO lesson_materials (
     lesson_id, material_type, title, position, storage_key, mime_type, byte_size,
     is_published, scan_status, scanned_at, scanned_by, content_sha256
   ) VALUES (
     $1, 'document', $2, $3, $4, 'application/pdf', $5,
     true, 'clean', now(), $admin_uuid, $6
   );
   ```

---

### Шаг 5. Интеграция сгенерированного Web-Preview
Для моментального открытия документов на смартфонах без скачивания тяжелых PDF:
- Файлы из `sorted_data_preview/` (содержащие легковесные `.webp` страницы и `index.html`) загружаются в CDN / статический контур или используются внутри мобильного WebView.

---

### Шаг 6. Валидация и Smoke-тестирование
После применения импорта обязательно выполните проверочные скрипты платформы:

```bash
# 1. Проверка целостности миграций SQL
node scripts/check-sql-migrations.mjs

# 2. Проверка изоляции данных и API безопасности
node scripts/check-api-security.mjs

# 3. Проверка прохождения уроков учеником
node scripts/check-learning-boundary.mjs

# 4. Проверка мобильного data plane
node scripts/check-mobile-first-party-data-plane.mjs
```

---

## 3. Справочник очередей материалов из `sorted_data`

| Папка | Назначение в платформе | Целевая таблица | Правило импорта |
|---|---|---|---|
| `01_mathematics` | Модули математики B1-B2, геометрия, алгебра | `lessons`, `practice_tests`, `lesson_materials` | PDF в storage, формулы в rich_text, тесты с ответами |
| `02_kyrgyz_language` | Грамматика, Окуу жана түшүнүү | `lessons`, `practice_questions` | 240 вопросов загружаются в базу тестов |
| `03_analogies` | Тренажер аналогий и связей слов | `practice_tests` (bank) | 245 аналогий импортируются в карточки практики |
| `04_jrt_tsoomo_full_tests` | Полноформатные пробные ОРТ/ЖРТ | `practice_tests` (mock) | Тесты с расчетом баллов 110-245 |
| `05_tasks_and_practice` | Домашние задания и тренинг | `practice_questions` | Практические упражнения к урокам |
| `06_chat_exports_and_history` | Архив Telegram | **НЕ ИМПОРТИРУЕТСЯ** | Заблокировано политикой безопасности |
| `07_photo_archives` | Иллюстрации к чертежам и задачам | `practice_questions.image_url` | После оптимизации WebP и привязки к `question_id` |
