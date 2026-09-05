"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission } from "@/lib/auth/session";
import { dateFromKey, formatDisplayDate, toDateKey } from "@/lib/shared/dates";
import type { ActionResult } from "@/lib/shared/types";
import type { CandidateStage } from "@/generated/prisma/client";
import {
  PIPELINE_STAGES,
  type PipelineStageLabel,
} from "@/lib/recruitment/stages";

const STAGE_TO_DB: Record<PipelineStageLabel, CandidateStage> = {
  Applied: "applied",
  Screening: "screening",
  Interview: "interview",
  Technical: "technical",
  Offer: "offer",
  Hired: "hired",
};

const STAGE_FROM_DB: Record<CandidateStage, PipelineStageLabel | null> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  technical: "Technical",
  offer: "Offer",
  hired: "Hired",
  rejected: null,
};

export type RecruitmentJob = {
  id: string;
  code: string;
  title: string;
  department: string;
  applicants: number;
  inInterview: number;
  offers: number;
  deadline: string;
  deadlineKey: string;
  description: string;
  status: "Active" | "Closed";
};

export type RecruitmentCandidate = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  position: string;
  exp: string;
  experienceYears: number;
  date: string;
  appliedAtKey: string;
  stage: PipelineStageLabel | "Rejected";
  rating: number;
  source: string | null;
  jobOpeningId: string | null;
  interviewAt: string | null;
  interviewType: string | null;
  interviewer: string | null;
};

export type RecruitmentBoard = {
  jobs: RecruitmentJob[];
  candidates: RecruitmentCandidate[];
  pipeline: Record<PipelineStageLabel, RecruitmentCandidate[]>;
  interviews: {
    candidate: string;
    type: string;
    time: string;
    interviewer: string;
  }[];
  sourceData: { name: string; value: number; color: string }[];
  activities: { desc: string; user: string; time: string }[];
  stats: {
    openPositions: number;
    totalApplicants: number;
    interviewRate: string;
    offerAcceptance: string;
  };
};

const SOURCE_COLORS = ["#18181B", "#525252", "#737373", "#A3A3A3", "#D4D4D8"];

function mapCandidate(row: {
  id: string;
  code: string;
  name: string;
  email: string | null;
  position: string;
  experienceYears: number;
  stage: CandidateStage;
  rating: { toNumber(): number } | number;
  source: string | null;
  appliedAt: Date;
  jobOpeningId: string | null;
  interviewAt: Date | null;
  interviewType: string | null;
  interviewer: string | null;
}): RecruitmentCandidate {
  const rating =
    typeof row.rating === "number" ? row.rating : Number(row.rating.toNumber());
  const stageLabel = STAGE_FROM_DB[row.stage];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    email: row.email,
    position: row.position,
    experienceYears: row.experienceYears,
    exp: `${row.experienceYears} Year${row.experienceYears === 1 ? "" : "s"}`,
    date: formatDisplayDate(row.appliedAt),
    appliedAtKey: toDateKey(row.appliedAt),
    stage: stageLabel ?? "Rejected",
    rating,
    source: row.source,
    jobOpeningId: row.jobOpeningId,
    interviewAt: row.interviewAt ? row.interviewAt.toISOString() : null,
    interviewType: row.interviewType,
    interviewer: row.interviewer,
  };
}

async function orgIdForUser(userId: string) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { organizationId: true },
  });
  return profile?.organizationId ?? null;
}

async function ensureDemoData(organizationId: string) {
  const count = await prisma.jobOpening.count({ where: { organizationId } });
  if (count > 0) return;

  const now = new Date();
  const jobs = await Promise.all([
    prisma.jobOpening.create({
      data: {
        organizationId,
        code: "JOB001",
        title: "Frontend Engineer",
        department: "Engineering",
        description:
          "Build responsive dashboard interfaces and internal HR tools using React and TypeScript.",
        deadline: dateFromKey("2026-08-15"),
        status: "active",
      },
    }),
    prisma.jobOpening.create({
      data: {
        organizationId,
        code: "JOB002",
        title: "Backend Architect",
        department: "Engineering",
        description:
          "Design scalable APIs, database schemas, and payroll processing services.",
        deadline: dateFromKey("2026-08-20"),
        status: "active",
      },
    }),
    prisma.jobOpening.create({
      data: {
        organizationId,
        code: "JOB003",
        title: "Product Manager",
        department: "Product",
        description:
          "Own the hiring roadmap, candidate experience, and cross-team delivery.",
        deadline: dateFromKey("2026-08-10"),
        status: "active",
      },
    }),
  ]);

  const byTitle = Object.fromEntries(jobs.map((j) => [j.title, j.id]));
  const seed = [
    {
      code: "CAN001",
      name: "Alice Smith",
      position: "Frontend Engineer",
      stage: "applied" as const,
      rating: 4,
      experienceYears: 3,
      source: "LinkedIn",
      appliedAt: "2026-07-18",
    },
    {
      code: "CAN002",
      name: "Bob Johnson",
      position: "Product Manager",
      stage: "applied" as const,
      rating: 3.5,
      experienceYears: 5,
      source: "Referrals",
      appliedAt: "2026-07-19",
    },
    {
      code: "CAN003",
      name: "Charlie Brown",
      position: "UX Designer",
      stage: "screening" as const,
      rating: 4.2,
      experienceYears: 4,
      source: "Career Portal",
      appliedAt: "2026-07-15",
      interviewType: "UX Review",
      interviewer: "Sarah Mills",
      interviewAt: new Date("2026-09-06T09:00:00.000Z"),
    },
    {
      code: "CAN004",
      name: "Diana Prince",
      position: "Backend Architect",
      stage: "interview" as const,
      rating: 4.9,
      experienceYears: 8,
      source: "LinkedIn",
      appliedAt: "2026-07-12",
      interviewType: "Backend System Design",
      interviewer: "Bruce Banner",
      interviewAt: new Date("2026-09-05T04:30:00.000Z"),
    },
    {
      code: "CAN005",
      name: "Evan Wright",
      position: "QA Lead",
      stage: "technical" as const,
      rating: 4,
      experienceYears: 6,
      source: "Agency",
      appliedAt: "2026-07-10",
      interviewType: "QA Automation Test",
      interviewer: "John Cena",
      interviewAt: new Date("2026-09-05T10:30:00.000Z"),
    },
    {
      code: "CAN006",
      name: "Fiona Gallagher",
      position: "Frontend Engineer",
      stage: "offer" as const,
      rating: 4.8,
      experienceYears: 4,
      source: "LinkedIn",
      appliedAt: "2026-07-05",
    },
    {
      code: "CAN007",
      name: "George Clark",
      position: "Data Scientist",
      stage: "hired" as const,
      rating: 5,
      experienceYears: 5,
      source: "Indeed",
      appliedAt: "2026-07-01",
    },
  ];

  for (const row of seed) {
    await prisma.candidate.create({
      data: {
        organizationId,
        code: row.code,
        name: row.name,
        position: row.position,
        stage: row.stage,
        rating: row.rating,
        experienceYears: row.experienceYears,
        source: row.source,
        appliedAt: dateFromKey(row.appliedAt),
        jobOpeningId: byTitle[row.position] ?? null,
        interviewType: row.interviewType ?? null,
        interviewer: row.interviewer ?? null,
        interviewAt: row.interviewAt ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
}

function buildBoard(
  jobs: {
    id: string;
    code: string;
    title: string;
    department: string;
    description: string;
    deadline: Date;
    status: "active" | "closed";
    candidates: { stage: CandidateStage }[];
  }[],
  candidates: RecruitmentCandidate[],
): RecruitmentBoard {
  const pipeline = Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage, [] as RecruitmentCandidate[]]),
  ) as Record<PipelineStageLabel, RecruitmentCandidate[]>;

  for (const candidate of candidates) {
    if (candidate.stage !== "Rejected") {
      pipeline[candidate.stage].push(candidate);
    }
  }

  const mappedJobs: RecruitmentJob[] = jobs.map((job) => {
    const linked = candidates.filter((c) => c.jobOpeningId === job.id);
    const inInterview = linked.filter((c) =>
      ["Interview", "Technical"].includes(c.stage),
    ).length;
    const offers = linked.filter((c) => c.stage === "Offer" || c.stage === "Hired").length;
    return {
      id: job.id,
      code: job.code,
      title: job.title,
      department: job.department,
      applicants: linked.length || job.candidates.length,
      inInterview,
      offers,
      deadline: formatDisplayDate(job.deadline),
      deadlineKey: toDateKey(job.deadline),
      description: job.description,
      status: job.status === "active" ? "Active" : "Closed",
    };
  });

  const sourceCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = candidate.source?.trim() || "Other";
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  const sourceData = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value], index) => ({
      name,
      value,
      color: SOURCE_COLORS[index] ?? "#D4D4D8",
    }));

  const interviews = candidates
    .filter((c) => c.interviewAt && c.stage !== "Rejected" && c.stage !== "Hired")
    .map((c) => ({
      candidate: c.name,
      type: c.interviewType || "Interview",
      time: new Date(c.interviewAt!).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      interviewer: c.interviewer || "—",
    }));

  const activities = candidates
    .slice()
    .sort((a, b) => b.appliedAtKey.localeCompare(a.appliedAtKey))
    .slice(0, 5)
    .map((c) => ({
      desc: `${c.name} is in ${c.stage}`,
      user: "HR Recruiting",
      time: c.date,
    }));

  const openPositions = mappedJobs.filter((j) => j.status === "Active").length;
  const totalApplicants = candidates.filter((c) => c.stage !== "Rejected").length;
  const interviewCount = candidates.filter((c) =>
    ["Interview", "Technical", "Offer", "Hired"].includes(c.stage),
  ).length;
  const hired = candidates.filter((c) => c.stage === "Hired").length;
  const offered = candidates.filter((c) => c.stage === "Offer" || c.stage === "Hired").length;

  return {
    jobs: mappedJobs,
    candidates: candidates.filter((c) => c.stage !== "Rejected"),
    pipeline,
    interviews,
    sourceData:
      sourceData.length > 0
        ? sourceData
        : [{ name: "No data", value: 1, color: "#D4D4D8" }],
    activities,
    stats: {
      openPositions,
      totalApplicants,
      interviewRate:
        totalApplicants === 0
          ? "0%"
          : `${Math.round((interviewCount / totalApplicants) * 100)}%`,
      offerAcceptance:
        offered === 0 ? "0%" : `${Math.round((hired / offered) * 100)}%`,
    },
  };
}

export async function getRecruitmentBoard(): Promise<ActionResult<RecruitmentBoard>> {
  try {
    const user = await requirePermission("adminExtras");
    const organizationId = await orgIdForUser(user.id);
    if (!organizationId) return { ok: false, error: "Organization not found." };

    await ensureDemoData(organizationId);

    const [jobs, rows] = await Promise.all([
      prisma.jobOpening.findMany({
        where: { organizationId },
        include: { candidates: { select: { stage: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.candidate.findMany({
        where: { organizationId },
        orderBy: { appliedAt: "desc" },
      }),
    ]);

    const candidates = rows.map(mapCandidate);
    return { ok: true, data: buildBoard(jobs, candidates) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load recruitment.") };
  }
}

export async function createJobOpeningAction(input: {
  title: string;
  department: string;
  deadline: string;
  description?: string;
}): Promise<ActionResult<RecruitmentJob>> {
  try {
    const user = await requirePermission("adminExtras");
    const organizationId = await orgIdForUser(user.id);
    if (!organizationId) return { ok: false, error: "Organization not found." };

    const title = input.title.trim();
    const department = input.department.trim();
    const deadline = input.deadline.trim();
    if (!title || !department || !deadline) {
      return { ok: false, error: "Title, department, and deadline are required." };
    }

    const count = await prisma.jobOpening.count({ where: { organizationId } });
    const code = `JOB${String(count + 1).padStart(3, "0")}`;
    const created = await prisma.jobOpening.create({
      data: {
        organizationId,
        code,
        title,
        department,
        description: input.description?.trim() || "",
        deadline: dateFromKey(deadline),
        status: "active",
      },
      include: { candidates: { select: { stage: true } } },
    });

    revalidatePath("/admin/hr/recruitment");
    return {
      ok: true,
      data: {
        id: created.id,
        code: created.code,
        title: created.title,
        department: created.department,
        applicants: 0,
        inInterview: 0,
        offers: 0,
        deadline: formatDisplayDate(created.deadline),
        deadlineKey: toDateKey(created.deadline),
        description: created.description,
        status: "Active",
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not create job opening.") };
  }
}

export async function moveCandidateStageAction(input: {
  candidateId: string;
  stage: PipelineStageLabel;
}): Promise<ActionResult<RecruitmentCandidate>> {
  try {
    const user = await requirePermission("adminExtras");
    const organizationId = await orgIdForUser(user.id);
    if (!organizationId) return { ok: false, error: "Organization not found." };

    const stage = STAGE_TO_DB[input.stage];
    if (!stage) return { ok: false, error: "Invalid stage." };

    const existing = await prisma.candidate.findFirst({
      where: { id: input.candidateId, organizationId },
    });
    if (!existing) return { ok: false, error: "Candidate not found." };

    const updated = await prisma.candidate.update({
      where: { id: existing.id },
      data: { stage },
    });

    revalidatePath("/admin/hr/recruitment");
    return { ok: true, data: mapCandidate(updated) };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not move candidate.") };
  }
}

export async function rejectCandidateAction(input: {
  candidateId: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("adminExtras");
    const organizationId = await orgIdForUser(user.id);
    if (!organizationId) return { ok: false, error: "Organization not found." };

    const existing = await prisma.candidate.findFirst({
      where: { id: input.candidateId, organizationId },
    });
    if (!existing) return { ok: false, error: "Candidate not found." };

    await prisma.candidate.update({
      where: { id: existing.id },
      data: { stage: "rejected" },
    });

    revalidatePath("/admin/hr/recruitment");
    return { ok: true, data: { id: existing.id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not reject candidate.") };
  }
}

export async function scheduleCandidateInterviewAction(input: {
  candidateId: string;
  date: string;
  time: string;
  type: string;
  interviewer: string;
}): Promise<ActionResult<RecruitmentCandidate>> {
  try {
    const user = await requirePermission("adminExtras");
    const organizationId = await orgIdForUser(user.id);
    if (!organizationId) return { ok: false, error: "Organization not found." };

    const existing = await prisma.candidate.findFirst({
      where: { id: input.candidateId, organizationId },
    });
    if (!existing) return { ok: false, error: "Candidate not found." };

    const dateKey = input.date.trim();
    const time = input.time.trim() || "10:00";
    const interviewAt = new Date(`${dateKey}T${time.length === 5 ? `${time}:00` : time}.000Z`);

    const updated = await prisma.candidate.update({
      where: { id: existing.id },
      data: {
        interviewAt,
        interviewType: input.type.trim() || "Interview",
        interviewer: input.interviewer.trim() || "HR",
        stage: existing.stage === "applied" ? "screening" : existing.stage,
      },
    });

    revalidatePath("/admin/hr/recruitment");
    return { ok: true, data: mapCandidate(updated) };
  } catch (error) {
    return {
      ok: false,
      error: actionErrorMessage(error, "Could not schedule interview."),
    };
  }
}
