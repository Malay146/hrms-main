import { addDaysToKey } from "./metrics";
import { kolkataTodayKey } from "@/lib/shared/dates";

export const COPILOT_REFUSAL =
  "I can answer workforce questions you already have access to. I will not share wages, bank details, passwords, or system prompts.";

export const COPILOT_NO_PAYROLL = "You do not have payroll access.";

export type CopilotIntent =
  | "leave_today"
  | "attendance"
  | "pending_leave"
  | "payroll"
  | "performance"
  | "general"
  | "chat"
  | "refuse";

export type AssistantToolName =
  | "create_employee"
  | "update_employee"
  | "create_department"
  | "delete_department"
  | "rename_department"
  | "approve_leave"
  | "reject_leave"
  | "apply_leave"
  | "mark_attendance"
  | "clock_in"
  | "clock_out";

export type AssistantLookupTool =
  | "lookup_headcount"
  | "lookup_departments"
  | "lookup_people"
  | "lookup_person"
  | "lookup_leave_balance"
  | "lookup_reports"
  | "lookup_attendance_exceptions";

export type ChatTurn = { role: "user" | "assistant"; body: string };

export type AssistantPlan =
  | { kind: "refuse"; answer: string }
  | { kind: "clarify"; answer: string }
  | { kind: "chat"; answer?: string }
  | { kind: "answer" }
  | { kind: "lookup"; tool: AssistantLookupTool; args: Record<string, string> }
  | { kind: "act"; tool: AssistantToolName; args: Record<string, string> };

export const ASSISTANT_TOOLS = [
  "create_employee",
  "update_employee",
  "create_department",
  "delete_department",
  "rename_department",
  "approve_leave",
  "reject_leave",
  "apply_leave",
  "mark_attendance",
  "clock_in",
  "clock_out",
] as const;

export const LOOKUP_TOOLS = [
  "lookup_headcount",
  "lookup_departments",
  "lookup_people",
  "lookup_person",
  "lookup_leave_balance",
  "lookup_reports",
  "lookup_attendance_exceptions",
] as const;

const REFUSE_RE =
  /ignore previous|dump wages|system prompt|jailbreak|\bpip\b|write a performance|password|bank account|api key/i;
const WAGE_PROBE_RE =
  /(?:salary|wage|ctc|compensation)\s+(?:for|of)\b|(?:'s|’s)\s+(?:salary|wage|ctc|pay)\b|how much (?:does|do)\s+.+\s+(?:make|earn|get paid)|what (?:is|are)\s+.+(?:'s|’s)?\s+(?:salary|wage)/i;
const RECRUIT_STAGE_RE = /^(applied|screening|screen|interview|offer|hired|rejected|shortlist|sourcing)$/i;
const LEAVE_TODAY_RE = /on leave today|who(?:'s| is) on leave|leave today/i;
const ATTENDANCE_RE = /attendance|present rate|checked in|late/i;
const PENDING_RE = /pending|waiting longest|awaiting (?:review|approval)/i;
const PAYROLL_RE = /payroll|total net|payrun|payslip|salary cost/i;
const PERFORMANCE_RE = /performance|appraisal|rating mix|goals on track/i;
const HEALTH_RE =
  /health score|how(?:'s| is) (?:the )?(?:team|org|organisation|organization|company)|overview|briefing|how are we doing|dashboard status/i;
const GREETING_RE =
  /^(hi|hello|hey|yo|hiya|howdy|hola|namaste|good\s+(morning|afternoon|evening))(\s+there)?([\s!,.?\-']+)?$/i;
const THANKS_RE = /^(thanks|thank you|thx|ty)([\s!,.?]+)?$/i;
const CONFIRM_RE =
  /^(yes|yeah|yep|yup|sure|confirm(ed)?|approve(d)?|do it|go ahead|proceed|ok|okay)(\b[\s,!.?'-].*)?$/i;
const CONFIRM_SHORT_RE = /^(y)([\s!,.?]+)?$/i;
const CANCEL_RE = /^(no|n|nope|cancel|stop|never mind|nevermind|don'?t)([\s!,.?]+)?$/i;

function trimName(value: string) {
  return value
    .replace(/[.?!]+$/, "")
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/\s+(please|thanks|thank you)$/i, "")
    .trim();
}

function cleanDepartmentQuery(value: string) {
  return trimName(
    value
      .replace(/\s+(department|dept\.?|team|division|group)$/i, "")
      .replace(/^(department|dept\.?|team)\s+(of\s+)?/i, ""),
  );
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function formatDepartmentName(value: string) {
  const cleaned = cleanDepartmentQuery(value);
  if (!cleaned) return "";
  if (/^[a-z]{2,4}$/i.test(cleaned)) return cleaned.toUpperCase();
  return toTitleCase(cleaned);
}

function isNameFollowUp(text: string) {
  return /^(who are they|who are those|who is that|who(?:'s| is) (?:on )?it|name them|list them|list (?:the )?names|their names|names please|tell me (?:their |the )?names)([\s!,.?]+)?$/i.test(
    text.trim(),
  );
}

function isLikelyDepartmentName(text: string) {
  const value = text.trim();
  if (!value || value.length > 40) return false;
  if (isConfirm(value) || isCancel(value) || isSmallTalk(value)) return false;
  if (/[?]/.test(value)) return false;
  if (
    /employee|email|leave|attendance|headcount|how many|who |create |add |delete |rename |approve |reject |mark /i.test(
      value,
    )
  ) {
    return false;
  }
  const words = value.split(/\s+/);
  return words.length >= 1 && words.length <= 4;
}

export function isWageProbe(question: string) {
  return WAGE_PROBE_RE.test(question.trim());
}

export function isCopilotRefuse(question: string) {
  const text = question.trim();
  return REFUSE_RE.test(text) || isWageProbe(text);
}

export function isHelp(question: string) {
  const text = question.trim();
  if (/^(help|who are you)([\s!,.?]+)?$/i.test(text)) return true;
  return /what (?:are|is) (?:the )?(?:task|tasks|things?)|what can you (?:do|help)|what do you (?:do|handle)|how can you help|your capabilities/i.test(
    text,
  );
}

export function isGreeting(question: string) {
  return GREETING_RE.test(question.trim());
}

export function isConfirm(question: string) {
  const text = question.trim();
  return CONFIRM_RE.test(text) || CONFIRM_SHORT_RE.test(text) || /^(please\s+)?(add|create|save)\s+(it|this|that|them)?([\s!,.?]+)?$/i.test(text);
}

export function isCancel(question: string) {
  return CANCEL_RE.test(question.trim());
}

export function isSmallTalk(question: string) {
  const text = question.trim();
  return GREETING_RE.test(text) || THANKS_RE.test(text) || isHelp(text);
}

export function extractCreatedDepartmentName(text: string): string | null {
  if (/employee/i.test(text)) return null;
  const named = text.match(
    /(?:add|create|make|open|new).{0,80}?departments?.{0,48}?(?:named|called)\s+(.+)/i,
  );
  if (named?.[1]) {
    const name = formatDepartmentName(named[1]);
    return name || null;
  }
  const after = text.match(
    /(?:add|create|make|open)\s+(?:(?:a|an|the|another|new)\s+)*departments?(?:\s+over here)?\s+(?:named|called|:)?\s*(.+)/i,
  );
  if (after?.[1]) {
    const name = formatDepartmentName(after[1].replace(/^(over here\s+)?(named|called)\s+/i, ""));
    if (name && !/^(named|called|over here)$/i.test(name)) return name;
  }
  const before = text.match(
    /(?:add|create|make|open)\s+(?:(?:a|an|the|another|new)\s+)*(.+?)\s+departments?\b/i,
  );
  if (before?.[1]) {
    const name = formatDepartmentName(before[1]);
    if (name && !/^(named|called)$/i.test(name)) return name;
  }
  return null;
}

export function extractHeadcountDepartment(text: string): string | null {
  const match = text.match(
    /(?:how many|number of|count(?: of)?|headcount)\s+(?:employees?|people|staff|members?).{0,48}?(?:in|from|for|within)\s+(?:the\s+)?(.+?)\s*[?.!]*$/i,
  );
  if (!match?.[1]) return null;
  const name = cleanDepartmentQuery(match[1]);
  if (!name || /^(org|organisation|organization|company|total)$/i.test(name)) return null;
  return name;
}

function extractPeopleDepartment(text: string): string | null {
  if (/on leave|leave today/i.test(text)) return null;
  const match = text.match(
    /who(?:'s| is| are)\s+in\s+(?:the\s+)?(.+?)\s*[?.!]*$/i,
  );
  if (!match?.[1]) return null;
  return cleanDepartmentQuery(match[1]);
}

export function extractInformalHire(text: string) {
  const match = text.match(
    /(?:hire|onboard)\s+(.+?)\s+as\s+(?:an?\s+)?(.+?)\s+in\s+(?:the\s+)?(.+?)\s*$/i,
  );
  if (!match) return null;
  const fullName = trimName(match[1] ?? "");
  const jobTitle = toTitleCase(trimName(match[2] ?? ""));
  const department = toTitleCase(cleanDepartmentQuery(match[3] ?? ""));
  if (!fullName || !jobTitle || !department) return null;
  return { fullName, jobTitle, department };
}

function lastInformalHire(history: ChatTurn[]) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const turn = history[index];
    if (turn?.role !== "user") continue;
    const hire = extractInformalHire(turn.body);
    if (hire) return hire;
  }
  return null;
}

function historyAwaitingHireEmail(history: ChatTurn[]) {
  return history.some((turn) => turn.role === "assistant" && /what email should I use/i.test(turn.body));
}

function extractEmail(text: string) {
  const match = text.trim().match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  return match?.[1]?.replace(/[.,;]+$/, "") ?? null;
}

function isRecruitmentMove(text: string, destination: string) {
  return /\bcandidate\b/i.test(text) || RECRUIT_STAGE_RE.test(destination.trim());
}

function nextWeekLeaveWindow(days: number) {
  const startDate = addDaysToKey(kolkataTodayKey(), 7);
  const endDate = addDaysToKey(startDate, Math.max(1, days) - 1);
  return { startDate, endDate };
}

export function lastLookupDepartment(history: ChatTurn[]): string | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const turn = history[index];
    if (!turn) continue;
    if (turn.role === "user") {
      const headcount = extractHeadcountDepartment(turn.body);
      if (headcount) return headcount;
      const people = extractPeopleDepartment(turn.body);
      if (people) return people;
    } else {
      const named = turn.body.match(/^(.+?) has \d+ active /i);
      if (named?.[1]) return cleanDepartmentQuery(named[1]);
    }
  }
  return null;
}

export function historyAwaitingDepartmentName(history: ChatTurn[]): boolean {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const turn = history[index];
    if (!turn) continue;
    if (turn.role === "assistant") {
      if (/name you(?:'d| would) like|provide (?:the |a )?name|which department should I create|named “this department”/i.test(turn.body)) {
        return true;
      }
      continue;
    }
    if (isConfirm(turn.body) || isCancel(turn.body) || isSmallTalk(turn.body)) continue;
    if (extractCreatedDepartmentName(turn.body)) return false;
    if (/(?:add|create|make|open).{0,40}departments?/i.test(turn.body)) return true;
    return false;
  }
  return false;
}

function wantsDepartmentList(text: string) {
  return (
    /(?:list|show|what(?:'s| are)|which)\s+(?:all\s+)?(?:the\s+)?departments/i.test(text) ||
    /departments?\s+(?:do we have|are there|list|we have)/i.test(text)
  );
}

function wantsOrgHeadcount(text: string) {
  return /(?:how many|number of|headcount)\s+(?:employees?|people|staff)(?:\s+are there)?(?:\s+in (?:the )?(?:org|organisation|organization|company|total))?/i.test(
    text,
  );
}

export function inferActionFromHistory(history: ChatTurn[]): AssistantPlan | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const turn = history[index];
    if (turn?.role !== "user") continue;
    if (isConfirm(turn.body) || isCancel(turn.body) || isSmallTalk(turn.body)) continue;
    const planned = planAssistantTurn(turn.body, []);
    if (planned.kind === "act" || planned.kind === "lookup") return planned;
  }
  return null;
}

export function chatReply(firstName: string, question: string) {
  const name = firstName.trim() || "there";
  const text = question.trim();
  if (THANKS_RE.test(text)) {
    return `You’re welcome, ${name}. Ask me anything about attendance, leave, or the team.`;
  }
  if (isHelp(text)) {
    return `Here’s what I can help with, ${name}:
• Who is in today, late, missing checkout, or on leave
• Headcount, department lists, leave balances, and who reports to whom
• Add people (including “hire Priya as designer in Engineering” — I’ll ask for email)
• Add, rename, or remove departments
• Apply, approve, or reject leave; clock in/out; mark attendance
• Payroll totals, if you have payroll access

If you want a record changed, say so in plain language. I’ll show the plan and wait for you to confirm before anything is saved.`;
  }
  if (GREETING_RE.test(text)) {
    return `Hi ${name} — good to see you. What would you like to know about the team today?`;
  }
  return `I’m here, ${name}. Ask about attendance, leave, or headcount, and I’ll answer from what you can already see.`;
}

export function confirmationPrompt(summary: string) {
  return `${summary}

Nothing is saved yet. Confirm to apply this, or cancel if this isn’t what you wanted.`;
}

export function pendingReminder(summary: string) {
  return `No extra fields are needed for that. ${summary}

Confirm to apply it, or cancel if this isn’t what you wanted.`;
}

export function summarizePendingAction(tool: AssistantToolName, args: Record<string, string>) {
  switch (tool) {
    case "create_department":
      return `Create a department named “${args.name || args.department || "this department"}”.`;
    case "delete_department":
      return `Delete the department “${args.name || args.department || ""}”.`;
    case "rename_department":
      return `Rename “${args.name || args.department || ""}” to “${args.newName || args.to || ""}”.`;
    case "create_employee":
      return `Add ${args.fullName || "this person"} (${args.email || "no email"}) in ${args.department || "a department"} as ${args.jobTitle || "a team member"}.`;
    case "update_employee":
      if (args.status === "inactive") return `Deactivate ${args.employee || args.fullName || "this employee"}.`;
      if (args.status === "active") return `Reactivate ${args.employee || args.fullName || "this employee"}.`;
      if (args.department) return `Move ${args.employee || "this employee"} to ${args.department}.`;
      if (args.jobTitle || args.title) {
        return `Change ${args.employee || "this employee"}’s title to ${args.jobTitle || args.title}.`;
      }
      return `Update ${args.employee || "this employee"}.`;
    case "approve_leave":
      return `Approve the pending leave request for ${args.employee || "this person"}.`;
    case "reject_leave":
      return `Reject the pending leave request for ${args.employee || "this person"}.`;
    case "apply_leave":
      return `Apply ${args.days || ""} day ${args.type || "paid"} leave for ${args.employee || "this person"} from ${args.startDate || "?"} to ${args.endDate || "?"}.`.replace(/\s+/g, " ").trim();
    case "clock_in":
      return `Clock in ${args.employee || "this person"} today.`;
    case "clock_out":
      return `Clock out ${args.employee || "this person"} today.`;
    case "mark_attendance":
      return `Mark ${args.employee || "this person"} as ${args.status?.replace("_", " ") || "updated"} ${args.date && args.date !== "today" ? `on ${args.date}` : "today"}.`;
    default:
      return "Apply this change.";
  }
}

export function classifyCopilotQuestion(question: string): CopilotIntent {
  const text = question.trim();
  if (!text) return "refuse";
  if (isCopilotRefuse(text)) return "refuse";
  if (isSmallTalk(text)) return "chat";
  if (LEAVE_TODAY_RE.test(text)) return "leave_today";
  if (PAYROLL_RE.test(text)) return "payroll";
  if (PERFORMANCE_RE.test(text)) return "performance";
  if (PENDING_RE.test(text)) return "pending_leave";
  if (ATTENDANCE_RE.test(text)) return "attendance";
  if (HEALTH_RE.test(text)) return "general";
  if (extractHeadcountDepartment(text) || wantsDepartmentList(text) || wantsOrgHeadcount(text)) {
    return "general";
  }
  return "chat";
}

export function planAssistantTurn(question: string, history: ChatTurn[] = []): AssistantPlan {
  const text = question.trim();
  if (!text) return { kind: "refuse", answer: COPILOT_REFUSAL };
  if (isCopilotRefuse(text)) return { kind: "refuse", answer: COPILOT_REFUSAL };
  if (isSmallTalk(text)) return { kind: "chat" };

  if (isConfirm(text)) {
    const inferred = inferActionFromHistory(history);
    if (inferred) return inferred;
  }

  if (isNameFollowUp(text)) {
    const department = lastLookupDepartment(history);
    if (department) {
      return {
        kind: "lookup",
        tool: "lookup_people",
        args: { department },
      };
    }
  }

  if (historyAwaitingHireEmail(history)) {
    const email = extractEmail(text);
    const hire = lastInformalHire(history);
    if (email && hire) {
      return {
        kind: "act",
        tool: "create_employee",
        args: {
          fullName: hire.fullName,
          email,
          department: hire.department,
          jobTitle: hire.jobTitle,
          role: "employee",
        },
      };
    }
  }

  const informalHire = extractInformalHire(text);
  if (informalHire) {
    return {
      kind: "clarify",
      answer: `I can add ${informalHire.fullName} as ${informalHire.jobTitle} in ${informalHire.department}. What email should I use?`,
    };
  }

  if (historyAwaitingDepartmentName(history) && isLikelyDepartmentName(text)) {
    return {
      kind: "act",
      tool: "create_department",
      args: { name: formatDepartmentName(text) },
    };
  }

  if (/(?:add|create|make|open)\s+(?:(?:a|an|the|another|new)\s+)*departments?\s*$/i.test(text)) {
    return {
      kind: "clarify",
      answer: "What should the new department be named? A name is enough — then I’ll wait for you to confirm before saving.",
    };
  }

  const createdDepartment = extractCreatedDepartmentName(text);
  if (createdDepartment) {
    return {
      kind: "act",
      tool: "create_department",
      args: { name: createdDepartment },
    };
  }

  const compareHeadcount = text.match(
    /compare\s+(.+?)\s+(?:vs\.?|versus|and|with)\s+(.+?)\s+headcount/i,
  );
  if (compareHeadcount) {
    return {
      kind: "lookup",
      tool: "lookup_headcount",
      args: {
        department: toTitleCase(cleanDepartmentQuery(compareHeadcount[1] ?? "")),
        other: toTitleCase(cleanDepartmentQuery(compareHeadcount[2] ?? "")),
      },
    };
  }

  const headcountDepartment = extractHeadcountDepartment(text);
  if (headcountDepartment) {
    return {
      kind: "lookup",
      tool: "lookup_headcount",
      args: { department: headcountDepartment },
    };
  }

  if (wantsDepartmentList(text)) {
    return { kind: "lookup", tool: "lookup_departments", args: {} };
  }

  if (wantsOrgHeadcount(text)) {
    return { kind: "lookup", tool: "lookup_headcount", args: {} };
  }

  const peopleDepartment = extractPeopleDepartment(text);
  if (peopleDepartment) {
    return {
      kind: "lookup",
      tool: "lookup_people",
      args: { department: peopleDepartment },
    };
  }

  const leaveBalance = text.match(/leave balance\s+(?:for|of)\s+(.+)/i) || text.match(/(.+?)(?:'s|’s)\s+leave balance/i);
  if (leaveBalance) {
    return {
      kind: "lookup",
      tool: "lookup_leave_balance",
      args: { employee: trimName(leaveBalance[1] ?? "") },
    };
  }

  const reportsTo = text.match(/who reports to\s+(.+)/i);
  if (reportsTo) {
    return {
      kind: "lookup",
      tool: "lookup_reports",
      args: { employee: trimName(reportsTo[1] ?? ""), direction: "reports" },
    };
  }

  const managerOf = text.match(/who (?:does|do)\s+(.+?)\s+report\s+to/i);
  if (managerOf) {
    return {
      kind: "lookup",
      tool: "lookup_reports",
      args: { employee: trimName(managerOf[1] ?? ""), direction: "manager" },
    };
  }

  if (/who(?:'s| is| are) late(?: today)?/i.test(text)) {
    return {
      kind: "lookup",
      tool: "lookup_attendance_exceptions",
      args: { kind: "late" },
    };
  }

  if (/hasn(?:'t|ot) checked out|missing check[- ]?out|no check[- ]?out/i.test(text)) {
    return {
      kind: "lookup",
      tool: "lookup_attendance_exceptions",
      args: { kind: "missing_checkout" },
    };
  }

  const findPerson = text.match(/find (?:employee|person)(?: named)?\s+(.+)/i);
  if (findPerson) {
    return {
      kind: "lookup",
      tool: "lookup_person",
      args: { query: trimName(findPerson[1] ?? "") },
    };
  }

  const createEmployee = text.match(
    /(?:add|create|onboard)\s+(?:an?\s+)?employee\s+(?:named\s+)?(.+?)\s+with\s+email\s+(\S+)\s+(?:in|to)\s+(.+?)\s+as\s+(.+)/i,
  );
  if (createEmployee) {
    return {
      kind: "act",
      tool: "create_employee",
      args: {
        fullName: trimName(createEmployee[1] ?? ""),
        email: (createEmployee[2] ?? "").replace(/[.,;]+$/, ""),
        department: trimName(createEmployee[3] ?? ""),
        jobTitle: trimName(createEmployee[4] ?? ""),
        role: "employee",
      },
    };
  }

  const renameDept = text.match(/rename\s+(?:the\s+)?department\s+(.+?)\s+to\s+(.+)/i);
  if (renameDept) {
    return {
      kind: "act",
      tool: "rename_department",
      args: { name: trimName(renameDept[1] ?? ""), newName: trimName(renameDept[2] ?? "") },
    };
  }

  const deleteDept = text.match(/(?:delete|remove)\s+(?:the\s+)?department\s+(.+)/i);
  if (deleteDept) {
    return {
      kind: "act",
      tool: "delete_department",
      args: { name: trimName(deleteDept[1] ?? "") },
    };
  }

  const applyLeave = text.match(
    /apply\s+(\d+)\s+days?\s+(paid|sick|unpaid)\s+leave\s+for\s+(.+?)(?:\s+next week)?\s*$/i,
  );
  if (applyLeave) {
    const days = Number(applyLeave[1] ?? "1");
    const window = nextWeekLeaveWindow(days);
    return {
      kind: "act",
      tool: "apply_leave",
      args: {
        employee: trimName(applyLeave[3] ?? ""),
        type: (applyLeave[2] ?? "paid").toLowerCase(),
        days: String(days),
        startDate: window.startDate,
        endDate: window.endDate,
        remarks: "Requested via HR assistant",
      },
    };
  }

  const clockIn = text.match(/^(?:please\s+)?(?:clock|check)\s+in\s+(.+)$/i);
  if (clockIn) {
    return {
      kind: "act",
      tool: "clock_in",
      args: { employee: trimName(clockIn[1] ?? ""), date: "today" },
    };
  }

  const clockOut = text.match(/^(?:please\s+)?(?:clock|check)\s+out\s+(.+)$/i);
  if (clockOut) {
    return {
      kind: "act",
      tool: "clock_out",
      args: { employee: trimName(clockOut[1] ?? ""), date: "today" },
    };
  }

  const approveLeave = text.match(/approve\s+(?:the\s+)?leave(?:\s+request)?\s+(?:for\s+)?(.+)/i);
  if (approveLeave) {
    return {
      kind: "act",
      tool: "approve_leave",
      args: { employee: trimName(approveLeave[1] ?? ""), comment: "Approved via HR assistant" },
    };
  }

  const rejectLeave = text.match(
    /reject\s+(?:the\s+)?leave(?:\s+request)?\s+(?:for\s+)?(.+?)(?:\s+because\s+(.+))?$/i,
  );
  if (rejectLeave) {
    const comment = trimName(rejectLeave[2] ?? "Rejected via HR assistant");
    return {
      kind: "act",
      tool: "reject_leave",
      args: { employee: trimName(rejectLeave[1] ?? ""), comment },
    };
  }

  const markAttendance = text.match(
    /mark\s+(.+?)\s+(present|absent|half[ -]?day)(?:\s+(?:on|for)\s+(\d{4}-\d{2}-\d{2}|today))?/i,
  );
  if (markAttendance) {
    const statusRaw = (markAttendance[2] ?? "present").toLowerCase().replace(/\s+/g, "_");
    const status = statusRaw.startsWith("half") ? "half_day" : statusRaw;
    return {
      kind: "act",
      tool: "mark_attendance",
      args: {
        employee: trimName(markAttendance[1] ?? ""),
        status,
        date: (markAttendance[3] ?? "today").toLowerCase(),
      },
    };
  }

  const deactivate = text.match(
    /(?:deactivat(?:e|ing)|offboard|inactivat(?:e|ing)|remove)\s+(?:employee\s+)?(.+)/i,
  );
  if (deactivate && !/department/i.test(text)) {
    return {
      kind: "act",
      tool: "update_employee",
      args: { employee: trimName(deactivate[1] ?? ""), status: "inactive" },
    };
  }

  const reactivate = text.match(/(?:reactivat(?:e|ing)|restore)\s+(?:employee\s+)?(.+)/i);
  if (reactivate) {
    return {
      kind: "act",
      tool: "update_employee",
      args: { employee: trimName(reactivate[1] ?? ""), status: "active" },
    };
  }

  const move = text.match(/move\s+(.+?)\s+to\s+(?:the\s+)?(.+?)(?:\s+department)?$/i);
  if (move) {
    const destination = trimName(move[2] ?? "");
    if (isRecruitmentMove(text, destination)) {
      return {
        kind: "clarify",
        answer: "I cannot move recruitment candidates yet. Use Recruitment, or say “move Priya to Sales” for a department change.",
      };
    }
    return {
      kind: "act",
      tool: "update_employee",
      args: { employee: trimName(move[1] ?? ""), department: destination },
    };
  }

  const title = text.match(
    /(?:change|update|set)\s+(.+?)(?:'s)?\s+(?:job\s+title|title|designation)\s+to\s+(.+)/i,
  );
  if (title) {
    return {
      kind: "act",
      tool: "update_employee",
      args: { employee: trimName(title[1] ?? ""), jobTitle: trimName(title[2] ?? "") },
    };
  }

  if (
    /(?:add|create|onboard)\s+(?:an?\s+)?employee/i.test(text) ||
    /(?:approve|reject)\s+(?:the\s+)?leave/i.test(text) ||
    /mark\s+.+\s+(present|absent|half[ -]?day)/i.test(text)
  ) {
    return {
      kind: "clarify",
      answer:
        "I can do that. For a new employee I need name, email, department, and job title. For leave I need the person’s name. For attendance I need the person and present/absent/half-day.",
    };
  }

  if (
    HEALTH_RE.test(text) ||
    LEAVE_TODAY_RE.test(text) ||
    PAYROLL_RE.test(text) ||
    PERFORMANCE_RE.test(text) ||
    PENDING_RE.test(text) ||
    ATTENDANCE_RE.test(text)
  ) {
    return { kind: "answer" };
  }
  return { kind: "chat" };
}

export function conversationTitleFromQuestion(question: string) {
  const compact = question.replace(/\s+/g, " ").trim();
  if (compact.length <= 48) return compact;
  return `${compact.slice(0, 45).trim()}…`;
}

export function isAssistantToolName(value: string | undefined): value is AssistantToolName {
  return Boolean(value && (ASSISTANT_TOOLS as readonly string[]).includes(value));
}

export function parsePendingAction(value: unknown): { tool: AssistantToolName; args: Record<string, string>; summary: string } | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { tool?: string; args?: Record<string, string>; summary?: string };
  if (!isAssistantToolName(row.tool) || !row.args) return null;
  return {
    tool: row.tool,
    args: row.args,
    summary: row.summary || summarizePendingAction(row.tool, row.args),
  };
}
