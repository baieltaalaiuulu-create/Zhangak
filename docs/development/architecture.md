# Архитектура и границы Zhangak

## Компоненты

```text
Browser / PWA / Expo
        |
        | HTTPS, domain-isolated session
        v
Next.js pages + same-origin /v1 BFF (:3200)
        |
        | loopback only
        v
Zhangak Node API (:3210)
        |
        +---- PostgreSQL (:5433, private)
        +---- private material volume
        +---- AI provider (server-side, feature flagged)
```

Nginx завершает TLS и обслуживает четыре домена. Порты API и PostgreSQL не
публикуются. Web release и API release идентифицируются одним Git SHA.

## Доменные границы

| Namespace | Кто вызывает | Правило |
| --- | --- | --- |
| `/v1/auth/*` | workspace-домены | login/refresh/logout/me; cookies не общие между доменами |
| `/v1/public/*` | только `zhangak.com` | опубликованные курсы и заявка без привилегий |
| `/v1/platform/*` | online/offline ученики, teacher в своём контуре | user identity берётся из session, доступ scoped сервером |
| `/v1/admin/*` | staff | каждый маршрут имеет собственную role/capability границу |
| `/api/*` | никто, кроме `/api/health` | старый namespace retired и возвращает 404 |

## Основные подсистемы

| Подсистема | Миграции | Backend-маршруты | Интерфейс |
| --- | --- | --- | --- |
| Auth/RBAC/profile | `001`, `004`, `021` | `auth`, `admin-users`, `admin-access`, `platform-profile` | login, access terms, profile |
| Курсы/уроки/практика | `002`, `006`, `008`, `012`, `013`, `015`, `020` | `platform-learning`, `admin-learning`, `admin-assessments`, roadmap/material/video routes | online ORT course, lessons/practice, admin content |
| Университеты | `003` | `platform-universities` | student catalog |
| Офлайн-класс | `007` | `platform-offline`, `platform-offline-classroom` | offline student, teacher journal |
| XP/daily/trainer/quests | `009`, `016`, `017`, `022` | `platform-gamification`, `admin-gamification` | daily task, trainer, quests, claims |
| Заявки/оплата | `010` | `public-applications`, `admin-enrollments` | landing, manager/admin queue |
| AI-коуч | `011` | `platform-ai`, `ai.js` | online AI chat |
| Push | `014` | push routes | PWA subscriptions and notifications |
| Social/profile | `018`, `019` | community/friend routes | public profiles, friends, blocks |

## Доверенные границы

- Пароль хэшируется сервером; access cookie короткоживущий, refresh rotating.
- Роль читается из PostgreSQL на каждом защищённом запросе.
- Баллы, XP, звёзды и завершение урока рассчитывает сервер.
- Ключ ответа хранится в private snapshot и показывается только после scoring.
- Online-доступ требует active enrollment на active online-курс.
- Offline teacher пишет только в назначенную активную группу.
- AI требует согласие, active online enrollment и rate limit; provider key
  существует только в API runtime.
- Файлы сначала проходят проверку типа/размера/scan-status и не обслуживаются
  Nginx как публичная директория.

## Источник истины

Схема — применённые файлы `backend/migrations` и ledger `schema_migrations`.
API-контракт — текущие маршруты и тесты `backend/test`. UI не является
авторизацией. Документы объясняют процесс, но не разрешают обход server-side
проверок.

Supabase хранится только как архивный источник миграции. Возвращение SDK,
PostgREST или Supabase Auth в runtime запрещено проверками data-plane.
