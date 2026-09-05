export type CopilotIntent =
  | "leave_today"
  | "attendance"
  | "pending_leave"
  | "payroll"
  | "general"
  | "refuse";

export const COPILOT_REFUSAL =
  "I can only answer questions about attendance, leave, headcount, and payroll totals you already have access to.";

export const COPILOT_NO_PAYROLL = "You do not have payroll access.";

const REFUSE_RE =
  /ignore previous|dump wages|system prompt|jailbreak|\bpip\b|performance review|write a performance|password|bank account|api key/i;
const LEAVE_TODAY_RE = /on leave today|who(?:'s| is) on leave|leave today/i;
const ATTENDANCE_RE = /attendance|present rate|checked in/i;
const PENDING_RE = /pending|waiting longest|awaiting (?:review|approval)/i;
const PAYROLL_RE = /payroll|total net|payrun|payslip|salary cost/i;

export function classifyCopilotQuestion(question: string): CopilotIntent {
  const text = question.trim();
  if (!text) return "refuse";
  if (REFUSE_RE.test(text)) return "refuse";
  if (LEAVE_TODAY_RE.test(text)) return "leave_today";
  if (PENDING_RE.test(text)) return "pending_leave";
  if (PAYROLL_RE.test(text)) return "payroll";
  if (ATTENDANCE_RE.test(text)) return "attendance";
  return "general";
}
