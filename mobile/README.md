# Жангак — mobile (Expo)

Native companion app for the Zhangak online student cabinet. Built with
Expo + expo-router, sharing the same Supabase project (`olqikkvjeutdgewmhnub`)
and tables as the Next.js web app — no separate backend.

## Setup

```bash
cd mobile
npm install
cp .env.example .env   # fill in EXPO_PUBLIC_SUPABASE_ANON_KEY (same anon
                        # key as the web app's NEXT_PUBLIC_SUPABASE_ANON_KEY)
npm start               # then press i / a / w, or scan the QR code with Expo Go
```

## Structure

```
app/
  _layout.tsx              root Stack — registers the (auth) and (student) groups
  (auth)/
    login.tsx              email/password sign-in, redirects to /(student) on success
  (student)/
    _layout.tsx             Tabs (Главная/Уроки/Тренажёр/ОРТ/AI) + the auth guard —
                             redirects to /login whenever there's no session
    index.tsx               dashboard: greeting, score progress, next-lesson hero, today's plan
    lessons.tsx              lessons list, accordion by subject
    lessons/[id].tsx         lesson detail (video + practice CTA)
    practice.tsx, ort.tsx, ai.tsx   placeholder screens — basic structure only
lib/
  supabase.ts               Supabase client, session persisted via expo-secure-store
  lessons.ts                practice_lessons / practice_results queries (mirrors
                             the web app's lib/lessons-data.ts)
components/
  LessonVideoPlayer.tsx      YouTube WebView embed (lesson videos are YouTube URLs,
                             same as web) with an expo-video fallback for direct
                             video files
  ScreenPlaceholder.tsx      shared "coming soon" shell for the 3 stub tabs
```

## Notes

- **Video**: lesson `video_url` values are YouTube links (same as the web
  app), so most lessons render through a WebView pointed at the YouTube
  iframe embed — `expo-video`/`expo-av` are wired up as a fallback path for
  the case a lesson ever points at a direct video file instead.
- **Scope**: Тренажёр / Пробный ОРТ / AI коуч are intentionally stub
  screens (`ScreenPlaceholder`) — only the dashboard and lessons flow are
  wired to real data per the initial scaffold.
- **Auth**: this app only serves the online student role (`role='student'
  student_type='online'`); other roles are signed back out with a message,
  mirroring the web app's role-based redirect but narrowed to what the
  mobile screens actually implement.
