export type WorkforceEmployee = {
  id: string;
  name: string;
  employeeCode: string;
  jobTitle: string;
  department: string;
  skills: { name: string; proficiency: number }[];
  gaps: { skillName: string; currentLevel: number; targetLevel: number; gap: number }[];
};

export type RoleSkillRequirementItem = {
  id: string;
  jobTitle: string;
  skillName: string;
  targetLevel: number;
};

export type WorkforceDashboard = {
  access: "hr" | "manager" | "employee";
  ownProfileId: string;
  employees: WorkforceEmployee[];
  roleRequirements: RoleSkillRequirementItem[];
  departments: {
    name: string;
    employees: number;
    employeesWithGaps: number;
    gapCount: number;
  }[];
};

export type Workforce360Data = {
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  department: string;
  tenureMonths: number | null;
  periodLabel: string;
  attendance: {
    attendancePct: number | null;
    absentDays: number;
    previousAttendancePct: number | null;
    recordedDays: number;
  };
  leave: { approvedDays: number; previousApprovedDays: number };
  performance: {
    latestRating: number | null;
    previousRating: number | null;
    goalCompletionPct: number | null;
    previousGoalCompletionPct: number | null;
    completedGoals: number;
    totalGoals: number;
  };
  departmentComparison: {
    sampleSize: number;
    attendancePct: number | null;
  } | null;
};

export type WorkforceReport = {
  title: string;
  periodLabel: string;
  rows: { label: string; value: string; detail: string; chartValue: number }[];
  summary: string;
  aiSummaryAvailable: boolean;
  limitation: string | null;
};
