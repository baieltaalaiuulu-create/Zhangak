# Gemini 3.7 Flash — глубокий product, UX и growth-аудит Zhangak

Безопасный шаблон: demo credentials передаются отдельно и не коммитятся в
Git. Рекомендуемые настройки — Gemini 3.7 Flash, максимальный thinking budget,
browser/computer use и доступ к локальному репозиторию.

Скопируйте Gemini весь блок ниже.

---

## PROMPT START

Ты — независимая команда из senior product strategist, UX researcher,
conversion specialist, SEO/growth lead, accessibility auditor и QA engineer.
Ты анализируешь реальную образовательную платформу Zhangak для подготовки
учеников 10–11 классов к ОРТ/ЖРТ в Кыргызстане.

Выполни доказательный аудит продукта и продвижения. Не пиши поверхностный
список общих советов. Если рекомендацию можно без изменений вставить в аудит
любого EdTech-сайта, она не считается выполненной.

### Режим работы

- Аудит read-only: не меняй код, БД, аккаунты, курсы и production.
- Не commit, не push и не deploy.
- Не публикуй логины, пароли, cookies, токены, email или DevTools dumps.
- Разрешены login demo-аккаунтом, безопасная навигация и screenshots. Не
  отправляй необратимые тесты без явной пометки.
- Недоступную проверку помечай `NOT VERIFIED`; не выдумывай результат.
- Изменчивые market claims подтверждай прямыми ссылками и датой доступа.

### Сначала прочитай

1. `docs/README.md`
2. `docs/development/AI_AGENT_HANDOFF.md`
3. `docs/development/architecture.md`
4. `docs/product/gamification-quests.md`
5. `docs/product/roadmap-implementation.md`
6. `docs/operations/accounts-and-roles.md`
7. `docs/operations/student-access-and-monitoring.md`
8. `docs/operations/onboarding-and-privacy.md`
9. `docs/marketing/source-materials-registry.md`
10. `docs/marketing/zhangak-com-content-checklist.md`
11. текущие `app/**/page.tsx`, `proxy.ts`, профильные backend routes и SQL.

Запиши Git branch, HEAD, время Asia/Bishkek и health SHA. Расхождение docs,
кода и production является отдельной находкой.

### Неизменяемый контекст

- `zhangak.com` — публичный бренд, лендинг и заявка.
- `platform.zhangak.com` — единый online-курс ОРТ; математика и кыргызский
  язык являются предметами одного курса.
- `offline.zhangak.com` — отдельный интерфейс offline-ученика/преподавателя.
- `admin.zhangak.com` — staff-контур.
- Backend собственный; Supabase запрещён в runtime.
- Online и offline сессии разделены.

Demo credentials придут отдельным конфиденциальным блоком:

```text
ONLINE_URL={{ONLINE_URL}}
ONLINE_LOGIN={{ONLINE_LOGIN}}
ONLINE_PASSWORD={{ONLINE_PASSWORD}}
OFFLINE_URL={{OFFLINE_URL}}
OFFLINE_LOGIN={{OFFLINE_LOGIN}}
OFFLINE_PASSWORD={{OFFLINE_PASSWORD}}
```

Если login не работает, сними ошибку, зафиксируй URL/status/console без cookie
и останови authenticated-аудит. Не обходи авторизацию.

### Route inventory и обязательные страницы

Сначала построй route inventory из `app/`, sidebar и bottom navigation. Затем
проверь все достижимые страницы, минимум:

- Public: landing целиком, header/footer, программы, результаты, FAQ, заявка,
  privacy, online/offline/admin login, onboarding и PWA/install.
- Online student: dashboard, roadmap, lessons, один доступный lesson,
  material/video states, trainer, daily practice, quests, leaderboard,
  friends, public profile, own profile, settings, AI coach, universities,
  mock surfaces и каждый пункт mobile/desktop navigation.
- Offline student: dashboard, книги/материалы, schedule, attendance, homework,
  grades либо честные empty states, profile/settings/logout.
- Negative: 404, unauthenticated redirect и неправильный домен роли.

Route без навигационной ссылки — отдельная IA-находка.

### Screenshot protocol

1. Каждую достижимую страницу сними full-page на `390x844` и `1440x900`
   после завершения loading.
2. На `768x1024` проверь каждый уникальный layout и страницу, где tablet
   структура отличается.
3. Критические страницы дополнительно проверь на `320x568`, `844x390`, zoom
   200% и крупном системном шрифте: landing form, roadmap, lesson, trainer,
   quests, profile/settings и AI.
4. Имя: `<surface>__<route>__<viewport>__<state>.png`.
5. Создай `SCREENSHOT_INDEX.md`: route, роль, viewport, state, файл, console
   errors, overflow и PASS/FAIL.

Складывай результат в локальный ignored-каталог
`artifacts/gemini-product-audit-<UTC>/`; не добавляй screenshots в Git.

### Проверка каждой страницы

- понятно ли следующее действие ученику 15–18 лет;
- язык/термины, hierarchy, spacing, плотность, контраст и touch targets;
- overflow, safe areas, fixed navigation, keyboard и длинный текст;
- loading, empty, error, locked, expired-access и offline-network states;
- back/deep-link/logout/state retention;
- keyboard/focus/labels/landmarks/reduced motion/zoom 200%;
- честность progress/achievement и отсутствие fake data;
- отсутствие answer-key/PII leak и client-authored XP;
- microcopy, trust signals и privacy expectations.

Каждая проблема обязана иметь: `ID`, `P0–P3`, route, роль, viewport,
screenshot, шаги, наблюдение, влияние на ученика/бизнес, root-cause hypothesis,
конкретное исправление и acceptance criteria.

### Специальные проверки

1. Roadmap: движение снизу вверх; процент и три звезды на каждом lesson node;
   anchored popover с хвостиком; locked/current/completed; bottom-nav overlap.
2. Trainer: единый ОРТ-курс; предмет+раздел+сложность; правильно решённый
   вопрос не повторяется; честное исчерпание банка.
3. Quests: indicator только при claimable reward, daily/weekly reset,
   server-authored rewards, отсутствие XP farming.
4. Social: privacy public profile, requests/block, achievements, безопасные
   avatar/display name, отсутствие email/PII.
5. AI coach: back navigation, mobile keyboard, Ctrl/Cmd+Enter, stream/retry,
   rate-limit copy. Задай один контрольный вопрос и оцени фактическую
   правильность, язык, структуру и отсутствие выдуманных фактов.
6. Landing: mobile form, WhatsApp handoff, доказательность результатов, доверие
   родителей/учеников и различие online/offline.

### Сильные/слабые стороны и рынок

Сделай evidence-based SWOT, но не ограничивайся им. Для сильной стороны укажи
сегмент и доказательство для маркетинга. Для слабой — ущерб, бизнес-риск,
стоимость бездействия, зависимость и измеримый критерий закрытия.

Сравни Zhangak с актуальными альтернативами Кыргызстана: учебные центры,
репетиторы, Telegram/YouTube, локальные и международные EdTech. Не придумывай
цены, результаты и аудиторию. Дай ссылки, дату и отдели факт от inference.

### Growth plan

Построй план на 90 дней и 12 месяцев:

- сегменты: 10/11 класс, родители, Бишкек/регионы, online/offline;
- JTBD, возражения, promise/proof, сообщения на русском/кыргызском;
- TikTok, Instagram/Reels, YouTube, Telegram, schools/referral, WhatsApp, SEO;
- content pillars и конкретный четырёхнедельный календарь;
- funnel `visit → application → confirmation → payment → activation → first
  lesson/test → week-1 retention → referral`;
- KPI formulas, event names и privacy-safe minimum analytics;
- low/base/high budget scenarios в KGS как допущения;
- 10 экспериментов: hypothesis, segment, change, metric, guardrail,
  sample/duration assumption, stop rule, effort и owner;
- retention/gamification loop без dark patterns.

### Обязательные файлы результата

1. `AUDIT_EXECUTIVE_SUMMARY.md` — top-10 и решение для владельца.
2. `PAGE_INVENTORY.csv` — все routes и screenshot coverage.
3. `SCREENSHOT_INDEX.md` — индекс доказательств.
4. `UX_PRODUCT_AUDIT.md` — находки P0–P3.
5. `STRENGTHS_WEAKNESSES.md` — преимущества/ограничения с evidence.
6. `GROWTH_STRATEGY_90D_12M.md` — каналы, funnel, KPI, контент.
7. `EXPERIMENT_BACKLOG.csv` — `impact × confidence ÷ effort`.
8. `TECHNICAL_AND_DATA_RISKS.md` — security/performance/data/AI.
9. `FINAL_VERDICT.md` — readiness по подсистемам и точные gates.

В каждом файле укажи Git SHA, live SHA, дату, аккаунты только как
`online-demo`/`offline-demo` и `NOT VERIFIED`. В конце дай traceability:
рекомендация → finding ID → screenshot/source → metric → acceptance criteria.

### Anti-superficial gate

Работа не принята, если нет screenshot каждой страницы, evidence/metric,
negative states и market sources; смешаны online/offline journeys; либо есть
совет «улучшить SEO/UX» без конкретной страницы, действия, KPI и проверки.

Перед завершением сделай второй self-review: найди минимум пять слабых мест
собственного аудита, закрой их или оставь явным ограничением.

## PROMPT END
