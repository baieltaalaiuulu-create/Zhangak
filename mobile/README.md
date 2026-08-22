# Жангак — mobile (Expo)

Native-only companion app for the Zhangak online student cabinet. Built
with Expo + expo-router and backed by the first-party Zhangak API at
`https://platform.zhangak.com/v1`.

## Setup

```bash
cd mobile
npm install
cp .env.example .env   # keep the production HTTPS API URL
npm start               # then press i / a, or scan the QR code with Expo Go
```

## Structure

```
app/
  _layout.tsx              root Stack + first-party native session provider
  (auth)/
    login.tsx              email/password sign-in, redirects to /(student) on success
  (student)/
    _layout.tsx             Tabs (Главная/Уроки/Тренажёр/ОРТ/AI) + the auth guard —
                             restores a first-party bearer session or redirects to /login
    index.tsx               dashboard: greeting, score progress, next-lesson hero, today's plan
    lessons.tsx              lessons list, accordion by subject
    lessons/[id].tsx         lesson detail (video + practice CTA)
    practice.tsx, ort.tsx, ai.tsx   placeholder screens — basic structure only
lib/
  native-auth.ts            first-party login / refresh / logout, SecureStore session,
                             and single-flight bearer-token refresh
  lessons.ts                strict DTO parsers and owned dashboard/lesson API reads
components/
  LessonVideoPlayer.tsx      YouTube WebView embed (lesson videos are YouTube URLs,
                             same as web) with an expo-video fallback for direct
                             video files
  ScreenPlaceholder.tsx      shared "coming soon" shell for the 3 stub tabs
```

## Notes

- **Video**: lesson `video_url` values are YouTube links (same as the web
  app), so most lessons render through a WebView pointed at the YouTube
  iframe embed — `expo-video` is wired up as a fallback path for
  the case a lesson ever points at a direct video file instead.
- **Scope**: Тренажёр / Пробный ОРТ are intentionally stub
  screens (`ScreenPlaceholder`) — only the dashboard and lessons flow are
  wired to real data per the initial scaffold.
- **Auth**: this app only serves student roles with online learning enabled
  (`role='student'`, `student_type='online'`). Login, session
  restore, refresh, and logout use
  the first-party API with an `Authorization: Bearer` token; refresh tokens
  are rotated by the API and both tokens are held only in Expo SecureStore.
- **Data plane**: dashboard and lessons use only owned `/v1/platform/*`
  endpoints. The app does not fabricate completion or score data; mobile
  practice completion remains an explicitly unavailable state until the
  server-scored attempt interface is added to the native UI.
- **Platforms**: this is an iOS/Android companion, not a second web client.
  Use [platform.zhangak.com](https://platform.zhangak.com) in a browser.
