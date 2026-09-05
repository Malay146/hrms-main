export type PerformanceCycleStatus = "open" | "closed";
export type PerformanceReviewStatus = "draft" | "submitted" | "acknowledged";
export type PerformanceGoalStatus = "not_started" | "in_progress" | "completed";

export type PerformanceGoalItem = {
  id: string;
  title: string;
  description: string;
  progress: number;
  status: PerformanceGoalStatus;
};

export type PerformanceReviewItem = {
  id: string;
  cycleId: string;
  cycleName: string;
  periodLabel: string;
  employeeId: string;
  employeeUserId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  jobTitle: string;
  reviewerName: string | null;
  status: PerformanceReviewStatus;
  overallRating: number | null;
  summary: string;
  employeeComments: string;
  submittedAt: string | null;
  acknowledgedAt: string | null;
  goals: PerformanceGoalItem[];
  goalsOnTrack: number;
};

export type PerformanceCycleItem = {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  status: PerformanceCycleStatus;
  reviewCount: number;
};

export type PerformanceEmployeeOption = {
  id: string;
  name: string;
  employeeId: string;
  department: string;
};

export type PerformanceBoard = {
  cycles: PerformanceCycleItem[];
  reviews: PerformanceReviewItem[];
  employees: PerformanceEmployeeOption[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  stats: {
    avgRating: number | null;
    pendingReviews: number;
    submittedReviews: number;
    acknowledgedReviews: number;
    goalsOnTrack: number;
    goalCount: number;
  };
  ratingDistribution: { name: string; value: number; color: string; percentage: string }[];
};
