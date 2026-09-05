# HR copilot capability audit

**Date:** 2026-09-06  
**Method:** Static review of `lib/ai/copilot.ts`, `lib/ai/assistant-execute.ts`, `lib/actions/ai.ts`, plus 52 jury prompts through `planAssistantTurn` (`npx tsx lib/ai/copilot-capability.probe.ts`).  
**Not executed:** live `askHrCopilot` (needs a signed-in `viewAiAnalytics` session and Confirm clicks).

## Executive summary

The copilot is not a general HR agent. It is a **router** with **8 write tools** and **3 SQL lookups**, plus a **30-day metrics snapshot** for a few dashboard questions. If a prompt does not match a regex (or the LLM planner, when the heuristic returns `chat`), the widget replies with small talk.

A jury will type informal English: “hire Priya as a designer,” “apply leave next week,” “run payroll for March,” “move this candidate to offer.” Most of those become **dead chat**. A few become **worse**: payroll verbs are answered as a **read-only net total**, and “move Ananya to offer” is planned as **move employee Ananya to a department named offer**.

Writes that do work still require **Confirm**. That is correct. The weakness is coverage and phrasing, not the confirmation gate.

## Probe totals (52 prompts, no history)

| Verdict | Count | Meaning |
| --- | ---: | --- |
| ok | 23 | Planner picked the intended act/lookup/answer/refuse |
| DEAD_CHAT | 23 | `kind: chat` — no tool, no snapshot |
| SNAPSHOT | 5 | `kind: answer` — aggregates only, does not perform the asked work |
| GAP (unsafe leak) | 1 | “What is Priya’s salary?” did **not** refuse |

`name them` is dead chat **without** prior history. With a previous department lookup in the thread, `isNameFollowUp` does plan `lookup_people` (covered in `lib/ai/copilot.test.ts`).

## What is possible today

### Live SQL lookups (immediate, no Confirm)

| User ask | Tool | Limit |
| --- | --- | --- |
| How many people / headcount in a department | `lookup_headcount` | Active employees only |
| List departments | `lookup_departments` | Org-scoped |
| Who is in Engineering | `lookup_people` | Needs “who is/are in …” phrasing |

### Mutations (Confirm, then existing server actions)

| User ask | Tool | Limit |
| --- | --- | --- |
| Create / rename / delete department | `create_department` / `rename_department` / `delete_department` | Informal create is relatively strong |
| Add employee | `create_employee` | One sentence: name + email + department + title |
| Move / change title / deactivate / reactivate | `update_employee` | Does not set manager, schedule, contract, wage |
| Approve / reject leave | `approve_leave` / `reject_leave` | **Latest pending request only**; cannot pick dates if several |
| Mark present / absent / half-day | `mark_attendance` | Status upsert, not clock times |

### Snapshot Q&A (`kind: answer`, 30-day `assembleAiSnapshot`)

Who is on leave today (names if `managePeople`), org attendance %, pending leave **count**, health score, latest **paid net** (if `viewPayrollAll`), average performance rating. This is dashboard recap, not a person-level operations API.

### Hard refusals (by design)

Jailbreaks, “dump wages”, bank account, password, API key, `\bpip\b` / “write a performance”.

## What is not possible (HRMS UI exists, copilot does not)

Grouped by product surface. Status is from planner + executor switch; if there is no tool, the executor cannot do it even if the LLM invents a name.

### People and time

| Capability | UI / action | Copilot |
| --- | --- | --- |
| Informal hire (“hire Priya as designer in Engineering”) | `createEmployeeAction` | Dead chat (regex too strict) |
| Apply leave for someone | `applyLeaveAction` | Impossible |
| Clock in / clock out | `clockInAction` / `clockOutAction` | Impossible |
| Missing checkout / who is late **by name** | Attendance lists | Snapshot % or dead chat |
| Leave balance for a named person | Profile / allocations | Dead chat |
| Org chart / reports-to | `managerId` on employee | Dead chat |
| Search by phone / employee ID (except some findEmployee in execute) | Employee directory | Dead chat unless already in an update tool |
| Spreadsheet import | `importEmployeesFromSpreadsheetAction` | Impossible (widget has no file upload) |
| Assign schedule | `upsertScheduleAction` | Impossible |
| Create / edit contract | `upsertContractAction` | Impossible |
| Time-off types | `upsertTimeOffTypeAction` | Impossible |
| Allocations | `upsertAllocationAction` / `decideAllocationAction` | Impossible |
| Batch approve all pending leave | Leave board | Snapshot count, no act |

### Payroll (must stay Confirm + no wage dump)

| Capability | UI / action | Copilot |
| --- | --- | --- |
| Create / compute / validate / mark paid payrun | `createPayrunAction`, `computePayrunAction`, … | **Stolen by PAYROLL_RE** → snapshot net total |
| Email payslips | `sendPayslipsAction` | Same snapshot steal |
| Salary structures / rules | `saveSalaryStructureAction` | Impossible (and should not dump amounts) |
| Edit a person’s wage | Employee hub | **Must stay blocked** |

### Recruitment, performance, comms

| Capability | UI / action | Copilot |
| --- | --- | --- |
| Create job opening | `createJobOpeningAction` | Dead chat |
| Move / reject / schedule candidate | `moveCandidateStageAction`, … | Dead chat **or false** `update_employee` |
| Performance cycle / review / goals | `upsertPerformanceCycleAction`, `savePerformanceReviewAction`, … | Snapshot aggregates or dead chat |
| Announcement | `createAnnouncementAction` | Dead chat |
| Generate analytics insights | `generateAiInsights` | Dead chat (page button only) |
| Flight-risk names | Analytics page | Dead chat (scores exist in snapshot internals, not a lookup tool) |
| Export CSV | Various UIs | Impossible |
| Undo last action | — | Impossible |
| Multi-step in one message | — | One tool per turn |

## False positives (dangerous in a demo)

1. **“Move candidate Ananya to offer”** → `act:update_employee` with department “offer”. Would Confirm-prompt a people move.
2. **“Create Engineering, Sales, and Design departments”** → `act:create_department` (one regex), not three creates.
3. **“Compute payrun for March” / “email all payslips” / “approve all pending leave” / “create a performance cycle”** → `answer` snapshot, which can sound like success without doing the work.
4. **“What is Priya’s salary?”** → `chat` (not refuse).

## Recommended waves

Do **not** let the model emit raw SQL. Add tools that wrap the same server actions the UI uses, keep Confirm on writes, tighten refuse.

**Wave A (jury):** informal create-employee; apply leave; clock in/out; named late/missing-checkout/leave-balance/reports-to; compare two department headcounts; refuse named salary; stop candidate-move from hitting people-move.

**Wave B (rest of HRMS):** recruitment, contracts, schedules, allocations, announcements, performance cycle/review, payrun compute/validate/email with Confirm, batch approve-leave / batch create-department.

**Stay blocked:** wages, bank, passwords, PIPs, arbitrary SQL, unconfirmed writes.

## Re-run

```bash
npx tsx lib/ai/copilot-capability.probe.ts
```
