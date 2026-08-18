# Второй том, PWA и Web Push

Документ описывает production-контракт Zhangak после переноса тяжёлых runtime-данных на отдельный том и внедрения устанавливаемого web-приложения.

## Размещение данных на VPS

Системный диск должен хранить ОС, Nginx, systemd и контейнерный runtime. Второй том `/mnt/HC_Volume_106608581` хранит данные Zhangak, которые растут независимо от ОС:

| Назначение | Физический путь на втором томе | Стабильный путь для сервисов |
|---|---|---|
| Web-релизы, `current`, `previous`, `incoming` | `zhangak-runtime/web` | `/var/www/zhangak` |
| API-релизы, `current`, `previous` | `zhangak-runtime/api` | `/var/www/zhangak-api` |
| Приватные материалы уроков | `zhangak-materials` | через `ZHANGAK_STORAGE_ROOT` |
| Локальные backup-артефакты | отдельные `zhangak-*.dump` | не являются off-site backup |

Web и API подключаются через bind mount, а не symlink. Это сохраняет абсолютные пути активации релиза и гарантирует, что `incoming` и `releases` остаются на одной файловой системе для атомарного `mv`.

Постоянные записи `/etc/fstab`:

```text
/mnt/HC_Volume_106608581/zhangak-runtime/web /var/www/zhangak none bind,x-systemd.requires-mounts-for=/mnt/HC_Volume_106608581 0 0
/mnt/HC_Volume_106608581/zhangak-runtime/api /var/www/zhangak-api none bind,x-systemd.requires-mounts-for=/mnt/HC_Volume_106608581 0 0
```

После перезагрузки проверяются `findmnt` для обоих путей, затем `systemctl is-active zhangak zhangak-api nginx`, `/v1/ready` и внешний `/api/health`. Не удаляйте или не форматируйте второй том, пока эти mount-пути используются. Второй том остаётся одной VPS-машиной и не заменяет зашифрованную off-site копию PostgreSQL.

## Установка на телефон

PWA доступна только на `platform.zhangak.com`. Установка не создаёт отдельный пароль и использует тот же защищённый аккаунт.

- Android/Chrome: «Настройки → Приложение → Установить» либо пункт браузера «Установить приложение».
- iPhone/iPad: открыть платформу в Safari, нажать «Поделиться», затем «На экран Домой». Push на iOS доступен из установленной PWA.
- После установки приложение работает в `standalone`, учитывает safe-area сверху/снизу и не кэширует `/v1`/`/api` ответы с личными данными.
- Offline fallback показывает только безопасную оболочку. Результаты, профиль и тестовые ответы всегда запрашиваются с сервера.

## Push-уведомления

Разрешение браузера запрашивается исключительно после нажатия ученика в настройках. Клиент получает только публичный VAPID-ключ. Приватный ключ хранится в `/etc/zhangak-api/zhangak-api.env` и никогда не попадает в Git или web-артефакт.

```text
VAPID_SUBJECT=mailto:admin@zhangak.com
VAPID_PUBLIC_KEY=<public>
VAPID_PRIVATE_KEY=<private>
```

Подписка хранится в `push_subscriptions` и привязана одновременно к `user_id` и `auth_sessions.id`. Logout, отзыв сессии или блокировка аккаунта исключают подписку из ежедневной отправки. Endpoint и криптографические ключи никогда не возвращаются ученику из API.

Ученик может:

1. включить или отключить push на конкретном устройстве;
2. выбрать напоминания об уроках, результатах и объявлениях;
3. отправить себе тестовое уведомление не чаще раза в минуту.

Systemd timer `zhangak-push-reminders.timer` запускается ежедневно около 19:00 по Бишкеку. Повторная отправка в тот же календарный день блокируется полем `last_reminder_at`; недействительные endpoints с HTTP 404/410 автоматически отзываются.

## Проверка после релиза

```sh
findmnt /var/www/zhangak /var/www/zhangak-api
systemctl is-active zhangak zhangak-api nginx
systemctl status zhangak-push-reminders.timer --no-pager
curl --fail --silent http://127.0.0.1:3210/v1/ready
curl --fail --silent https://platform.zhangak.com/api/health
```

В браузере проверяются ширины 320, 360, 390, 430 и 768 px: отсутствие горизонтального scroll, доступность нижней навигации, кнопки установки и карточки push. Разрешение на push нельзя запрашивать автоматически при входе или во время onboarding.
