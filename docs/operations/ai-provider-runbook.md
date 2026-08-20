# AI provider runbook

The Zhangak AI coach is a server-only service for active online-course students who have accepted the AI consent notice. Its conversation history, rate limit and course-access check stay in the first-party API. Browser code never receives an AI provider key.

## Supported providers

`AI_PROVIDER` chooses `deepseek` or `openai`; `AI_FALLBACK_PROVIDER` is optional and is used only after a primary 503-style failure. A 429 is deliberately not retried through the fallback, so a traffic spike cannot silently move spend to the other provider.

The production defaults are `deepseek-v4-flash` (900 output tokens) and `gpt-5-mini` (700 output tokens). The OpenAI model supports the Chat Completions endpoint and is a cost-efficient option for bounded tutoring requests. Configure a provider-side project budget and alert as the final cost boundary.

## Secure production setup

1. Put `AI_ENABLED=1`, the provider selection and secrets only in `/etc/zhangak-api/zhangak-api.env` (root-owned, mode 600). Never commit them or prefix them with `NEXT_PUBLIC_`.
2. Restart `zhangak-api` after an environment change.
3. Run `node scripts/ai-provider-smoke.js openai` or `deepseek` from the API release directory. The smoke check sends exactly two fixed, non-personal prompts and prints only the provider/result boundary.
4. Verify an enrolled demo student: consent is required, a message is persisted only to their own conversation, and the ninth user message inside 15 minutes receives `429`.
5. Rotate any key that has appeared in chat, a screenshot, source control or terminal output before accepting production student traffic.

The API prompt confines answers to math, Kyrgyz language and ORT strategy, rejects instruction changes, avoids fabricated facts and keeps replies concise. Prompting reduces risk; it does not replace review of course content or provider-side spend limits.
