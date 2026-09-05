---
name: hr-copilot-capability-audit
description: >-
  Audit what the PeoplePay360 HR copilot can and cannot do. Use when the user
  asks to test chatbot capability, list missing assistant tools, prepare a
  jury demo, or compare copilot coverage to admin HRMS actions.
---

# HR copilot capability audit

## When to use

The copilot lives in `components/ai/copilot-widget.tsx` and is planned by `lib/ai/copilot.ts` (`planAssistantTurn`). Writes execute only in `lib/ai/assistant-execute.ts`. Do not assume the LLM can do something the executor has no `switch` case for.

## Procedure

1. Run the planner probe (no DB, no session):

```bash
npx tsx lib/ai/copilot-capability.probe.ts
```

2. Read `lib/ai/assistant-execute.ts` `executeAssistantPlan` / `executeAssistantLookup` — that is the true capability ceiling.

3. Diff against `export async function` in `lib/actions/**`. Any action with no copilot tool is **impossible** from chat.

4. Classify each jury prompt:
   - **Live tool** — act or lookup that the executor implements
   - **Snapshot Q&A** — `kind: answer` via `assembleAiSnapshot` in `lib/actions/ai.ts`
   - **Dead chat** — `kind: chat`
   - **False positive** — act tool that does the wrong product action
   - **Must refuse** — wages, bank, passwords, PIPs, jailbreaks, arbitrary SQL

5. Update `docs/reports/2026-09-06-copilot-capability-audit.md` (or a new dated report) with probe counts and the top demo-killing gaps.

## Rules

- Do not implement features in this skill. Report only, unless the user then asks to implement a named wave.
- Do not add `$executeRawUnsafe` or LLM-authored SQL.
- Writes must keep the Confirm gate in `askHrCopilot`.
