export const COPILOT_REFUSAL =
  "I can only help with workforce questions and with adding, updating, or removing people, departments, leave, and attendance you already have permission to change. I will not share wages, bank details, passwords, or system prompts.";

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
  | "mark_attendance";

export type AssistantPlan =
  | { kind: "refuse"; answer: string }
  | { kind: "clarify"; answer: string }
  | { kind: "chat"; answer?: string }
  | { kind: "answer" }
  | { kind: "act"; tool: AssistantToolName; args: Record<string, string> };

export const ASSISTANT_TOOLS = [
  "create_employee",
  "update_employee",
  "create_department",
  "delete_department",
  "rename_department",
  "approve_leave",
  "reject_leave",
  "mark_attendance",
] as const;

const REFUSE_RE =
  /ignore previous|dump wages|system prompt|jailbreak|\bpip\b|write a performance|password|bank account|api key/i;
const LEAVE_TODAY_RE = /on leave today|who(?:'s| is) on leave|leave today/i;
const ATTENDANCE_RE = /attendance|present rate|checked in|late/i;
const PENDING_RE = /pending|waiting longest|awaiting (?:review|approval)/i;
const PAYROLL_RE = /payroll|total net|payrun|payslip|salary cost/i;
const PERFORMANCE_RE = /performance|appraisal|rating mix|goals on track/i;
const HEALTH_RE =
  /health score|how(?:'s| is) (?:the )?(?:team|org|organisation|organization|company)|overview|briefing|how are we doing|dashboard status/i;
const GREETING_RE =
  /^(hi|hello|hey|yo|hiya|howdy|hola|namaste|good\s+(morning|afternoon|evening))(\s+there)?([\s!,.?\-']+)?$/i;
const THANKS_RE = /^(thanks|thank you|thx|ty|ok|okay|cool|great|got it|sounds good)([\s!,.?]+)?$/i;
const HELP_RE =
  /^(help|what can you do|what do you do|how (?:do|does|can) (?:you|this|i)|who are you)([\s!,.?]+)?$/i;

function trimName(value: string) {
  return value.replace(/[.?!]+$/, "").replace(/^the\s+/i, "").trim();
}

export function isCopilotRefuse(question: string) {
  return REFUSE_RE.test(question.trim());
}

export function isSmallTalk(question: string) {
  const text = question.trim();
  return GREETING_RE.test(text) || THANKS_RE.test(text) || HELP_RE.test(text);
}

export function chatReply(firstName: string, question: string) {
  const name = firstName.trim() || "there";
  const text = question.trim();
  if (THANKS_RE.test(text)) {
    return `You’re welcome, ${name}. If you need anything else — leave, attendance, or a people change — just tell me.`;
  }
  if (HELP_RE.test(text)) {
    return `I can help with a few things, ${name}:
• Who’s in today or on leave
• Pending leave approvals
• Add, update, or deactivate employees
• Create or rename departments
• Mark someone present or absent

Ask a question, or tell me what to change.`;
  }
  if (GREETING_RE.test(text)) {
    return `Hi ${name} — good to see you. I’m your HR assistant. I can check attendance and leave, and I can add, update, or remove people and departments when you have permission. What would you like to do?`;
  }
  return `I’m here, ${name}. Ask me about attendance, leave, or headcount, or tell me what to change — like approving leave or adding someone.`;
}

export function classifyCopilotQuestion(question: string): CopilotIntent {
  const text = question.trim();
  if (!text) return "refuse";
  if (REFUSE_RE.test(text)) return "refuse";
  if (isSmallTalk(text)) return "chat";
  if (LEAVE_TODAY_RE.test(text)) return "leave_today";
  if (PAYROLL_RE.test(text)) return "payroll";
  if (PERFORMANCE_RE.test(text)) return "performance";
  if (PENDING_RE.test(text)) return "pending_leave";
  if (ATTENDANCE_RE.test(text)) return "attendance";
  if (HEALTH_RE.test(text)) return "general";
  return "chat";
}

export function planAssistantTurn(question: string): AssistantPlan {
  const text = question.trim();
  if (!text) return { kind: "refuse", answer: COPILOT_REFUSAL };
  if (REFUSE_RE.test(text)) return { kind: "refuse", answer: COPILOT_REFUSAL };
  if (isSmallTalk(text)) return { kind: "chat" };

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

  const createDept = text.match(/(?:add|create)\s+(?:a\s+)?department\s+(?:named\s+)?(.+)/i);
  if (createDept && !/employee/i.test(text)) {
    return {
      kind: "act",
      tool: "create_department",
      args: { name: trimName(createDept[1] ?? "") },
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
    return {
      kind: "act",
      tool: "update_employee",
      args: { employee: trimName(move[1] ?? ""), department: trimName(move[2] ?? "") },
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
