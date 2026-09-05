# Copilot Wave A Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the HR copilot survive a jury demo for everyday people operations: informal hire, leave apply, clock in/out, named lookups, and stop false positives (salary leak, candidate-move).

**Architecture:** Extend `planAssistantTurn` heuristics and `executeAssistantLookup` / `executeAssistantPlan`. New writes wrap existing actions (`createEmployeeAction`, `upsertAttendanceAction`) or a staff `applyLeaveForEmployeeAction`. Lookups are parameterized SQL in `copilot-query.ts`. Confirm gate in `askHrCopilot` stays. No arbitrary SQL, no wages.

**Tech Stack:** `lib/ai/copilot.ts`, `assistant-execute.ts`, `copilot-query.ts`, `lib/actions/people/leave.ts`, node:test.

---

Wave A is implemented in-repo in this session. Tests live in `lib/ai/copilot.test.ts`. Re-run `npx tsx lib/ai/copilot-capability.probe.ts` after.
