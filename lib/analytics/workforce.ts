export type SkillRequirement = {
  skillName: string;
  targetLevel: number;
};

export type EmployeeSkillLevel = {
  name: string;
  proficiency: number;
};

export type SkillGap = {
  skillName: string;
  currentLevel: number;
  targetLevel: number;
  gap: number;
};

export type WorkforceReportTemplate =
  | "attendance"
  | "leave"
  | "performance"
  | "skill_gap"
  | "unsupported";

export function classifyWorkforceReportQuestion(question: string): WorkforceReportTemplate {
  const normalized = question.toLowerCase();
  if (/turnover|attrition|resign|left the company/.test(normalized)) return "unsupported";
  if (/skill|competenc/.test(normalized)) return "skill_gap";
  if (/performance|goal|review|rating/.test(normalized)) return "performance";
  if (/leave|time off|holiday/.test(normalized)) return "leave";
  if (/attendance|absen|present|late/.test(normalized)) return "attendance";
  return "unsupported";
}

export function workforceVisibleEmployeeIds(
  isHr: boolean,
  profileId: string,
  directReportIds: string[],
): string[] | undefined {
  if (isHr) return undefined;
  return [...new Set([profileId, ...directReportIds])];
}

export function calculateSkillGaps(
  requirements: SkillRequirement[],
  skills: EmployeeSkillLevel[],
): SkillGap[] {
  const proficiencyBySkill = new Map(
    skills.map((skill) => [skill.name.trim().toLocaleLowerCase(), skill.proficiency]),
  );

  return requirements
    .map((requirement) => {
      const currentLevel =
        proficiencyBySkill.get(requirement.skillName.trim().toLocaleLowerCase()) ?? 0;
      return {
        skillName: requirement.skillName,
        currentLevel,
        targetLevel: requirement.targetLevel,
        gap: Math.max(0, requirement.targetLevel - currentLevel),
      };
    })
    .filter((gap) => gap.gap > 0)
    .sort((left, right) => right.gap - left.gap || left.skillName.localeCompare(right.skillName));
}

export function summarizeAttendance(statuses: string[]) {
  const attended = statuses.filter((status) => status === "present" || status === "half_day").length;
  const absences = statuses.filter((status) => status === "absent").length;
  const eligible = attended + absences;
  return {
    recordedDays: statuses.length,
    attendedDays: attended,
    absentDays: absences,
    attendancePct: eligible === 0 ? null : Math.round((attended / eligible) * 100),
  };
}

export function summarizeGoals(progress: number[]) {
  if (progress.length === 0) return { total: 0, completed: 0, completionPct: null };
  const completed = progress.filter((value) => value >= 100).length;
  return {
    total: progress.length,
    completed,
    completionPct: Math.round((completed / progress.length) * 100),
  };
}

export function isValidAnalyticsDateRange(startDate: string, endDate: string, maxDays = 366) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return false;
  }
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return false;
  if (
    new Date(start).toISOString().slice(0, 10) !== startDate ||
    new Date(end).toISOString().slice(0, 10) !== endDate
  ) {
    return false;
  }
  return (end - start) / 86_400_000 < maxDays;
}

export function isValidProficiency(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}
