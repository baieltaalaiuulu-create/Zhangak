# Student visual prototype QA

Date: 2026-08-18  
Viewport: 390 × 844  
Reference: `artifacts/prototype-reference-2026-08-18/`  
Live captures: `artifacts/design-qa-2026-08-18/`

## Compared surfaces

- Student dashboard: HUD, hero, primary roadmap CTA, honest ORT forecast, streak and bottom navigation.
- Roadmap: unit cards, completion percentage, three-star state, current lesson, rewards and bottom-to-top progression.
- Trainer: subject, section and difficulty controls, primary action, history/reset and bottom navigation.
- Lesson detail: mobile hierarchy and authenticated private PDF material cards.

The normalized side-by-side comparison is stored at
`artifacts/design-qa-2026-08-18/reference-vs-live.png`.

## Findings and corrections

- No prototype names, scores or progress were copied into production; all visible values are first-party API data.
- Roadmap was empty in live data. Four published units and six canonical lesson placements now provide the intended real hierarchy.
- Imported trainer banks were unpublished. Four reviewed bank partitions containing 485 questions are now published for the Kyrgyz online course.
- Private lesson PDFs initially rendered only in the desktop branch. The mobile lesson page now shows and opens authenticated material cards.
- Daily challenge and mock test entry points were restored below the trainer without bypassing their server-owned flows.
- Correct answers remain absent before submission; the live trainer check returned only question text and four public choices.

## Verification

- Mobile dashboard, Roadmap, trainer and lesson-material screens render without console errors.
- All primary bottom-navigation links resolve to the owned platform routes.
- Imported material count: 34; all 34 are `clean` and published; storage file count is 34.
- The importer replay is idempotent: 0 imported, 34 reused.
- Web production build, standalone smoke, TypeScript, ESLint, backend tests and unit tests passed.

final result: passed
