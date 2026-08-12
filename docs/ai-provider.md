# AI provider operation

All server-side AI calls go through `lib/ai-gateway.ts`. Browser code must
never call an AI vendor directly or receive a provider API key.

## DeepSeek production profile

Set these runtime-only variables in `/etc/zhangak/zhangak.env`:

```dotenv
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=replace-me
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_FAST_MODEL=deepseek-v4-flash
DEEPSEEK_REASONING_MODEL=deepseek-v4-pro
DEEPSEEK_FAST_MAX_TOKENS=1200
DEEPSEEK_REASONING_MAX_TOKENS=2400
```

The gateway selects the model on the server:

- ordinary explanations, motivation and short questions use V4 Flash with
  thinking disabled;
- analysis, plans and long student prompts use V4 Pro with thinking enabled
  at `high` effort;
- only final `content` is returned to the application. Provider
  `reasoning_content` is intentionally discarded;
- output caps limit latency and accidental spend. Invalid overrides fall back
  to the documented defaults.

The legacy `deepseek-chat` and `deepseek-reasoner` aliases must not be used.
They were retired on 2026-07-24. Confirm current model names against the
official DeepSeek model list before changing them.

## Activation and rotation

Do not set `AI_PROVIDER=deepseek` on a release that predates DeepSeek gateway
support. Store the key first, deploy the supporting Git SHA, then change the
provider and restart the service. Verify a student mentor response and an
admin analytics response without logging prompts, completions, authorization
headers, or the key.

To rotate the key, update only the root-owned runtime env file, restart the
service, verify both model tiers, and revoke the old key. Never place a real
key in `.env.example`, a CI variable exposed to builds, a release artifact, or
a `NEXT_PUBLIC_` variable.
