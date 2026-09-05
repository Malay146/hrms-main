"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission } from "@/lib/auth/session";
import { dateFromKey, formatDisplayDate, toDateKey } from "@/lib/shared/dates";
import { clampPage, clampPageSize, pageSkip, totalPagesFor } from "@/lib/shared/pagination";
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
  applicantsPage: number;
  applicantsPageSize: number;
  applicantsTotal: number;
  applicantsTotalPages: number;
};

const SOURCE_COLORS = ["#18181B", "#525252", "#737373", "#A3A3A3", "#D4D4D8"];
const STAGE_PREVIEW = 8;

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

function emptyPipeline(): Record<PipelineStageLabel, RecruitmentCandidate[]> {
  return Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage, [] as RecruitmentCandidate[]]),
  ) as Record<PipelineStageLabel, RecruitmentCandidate[]>;
}

export async function getRecruitmentBoard(input?: {
  page?: number;
  pageSize?: number;
  search?: string;
  stage?: string;
  position?: string;
}): Promise<ActionResult<RecruitmentBoard>> {
  try {
    const user = await requirePermission("adminExtras");
    const organizationId = await orgIdForUser(user.id);
    if (!organizationId) return { ok: false, error: "Organization not found." };

    await ensureDemoData(organizationId);

    const page = clampPage(input?.page);
    const pageSize = clampPageSize(input?.pageSize, 15);
    const search = input?.search?.trim() ?? "";
    const stageLabel = input?.stage?.trim() || "All";
    const position = input?.position?.trim() || "All";
    const stageDb =
      stageLabel !== "All" && stageLabel in STAGE_TO_DB
        ? STAGE_TO_DB[stageLabel as PipelineStageLabel]
        : undefined;

    const applicantWhere = {
      organizationId,
      stage: stageDb ? stageDb : { not: "rejected" as const },
      ...(position !== "All" ? { position } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { code: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [jobs, stageCounts, sourceGroups, applicantsTotal, applicantRows, interviewRows, activityRows, pipelineRows] =
      await Promise.all([
        prisma.jobOpening.findMany({
          where: { organizationId },
          select: {
            id: true,
            code: true,
            title: true,
            department: true,
            description: true,
            deadline: true,
            status: true,
            _count: { select: { candidates: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        prisma.candidate.groupBy({
          by: ["stage"],
          where: { organizationId },
          _count: { _all: true },
        }),
        prisma.candidate.groupBy({
          by: ["source"],
          where: { organizationId, stage: { not: "rejected" } },
          _count: { _all: true },
        }),
        prisma.candidate.count({ where: applicantWhere }),
        prisma.candidate.findMany({
          where: applicantWhere,
          orderBy: { appliedAt: "desc" },
          skip: pageSkip(page, pageSize),
          take: pageSize,
        }),
        prisma.candidate.findMany({
          where: {
            organizationId,
            interviewAt: { not: null },
            stage: { notIn: ["rejected", "hired"] },
          },
          orderBy: { interviewAt: "asc" },
          take: 12,
        }),
        prisma.candidate.findMany({
          where: { organizationId, stage: { not: "rejected" } },
          orderBy: { appliedAt: "desc" },
          take: 5,
        }),
        Promise.all(
          PIPELINE_STAGES.map((label) =>
            prisma.candidate.findMany({
              where: { organizationId, stage: STAGE_TO_DB[label] },
              orderBy: { appliedAt: "desc" },
              take: STAGE_PREVIEW,
            }),
          ),
        ),
      ]);

    const countByStage = new Map(stageCounts.map((row) => [row.stage, row._count._all]));
    const jobStageCounts = await prisma.candidate.groupBy({
      by: ["jobOpeningId", "stage"],
      where: { organizationId, jobOpeningId: { not: null } },
      _count: { _all: true },
    });

    const mappedJobs: RecruitmentJob[] = jobs.map((job) => {
      const linked = jobStageCounts.filter((row) => row.jobOpeningId === job.id);
      const inInterview = linked
        .filter((row) => row.stage === "interview" || row.stage === "technical")
        .reduce((sum, row) => sum + row._count._all, 0);
      const offers = linked
        .filter((row) => row.stage === "offer" || row.stage === "hired")
        .reduce((sum, row) => sum + row._count._all, 0);
      return {
        id: job.id,
        code: job.code,
        title: job.title,
        department: job.department,
        applicants: job._count.candidates,
        inInterview,
        offers,
        deadline: formatDisplayDate(job.deadline),
        deadlineKey: toDateKey(job.deadline),
        description: job.description,
        status: job.status === "active" ? "Active" : "Closed",
      };
    });

    const pipeline = emptyPipeline();
    PIPELINE_STAGES.forEach((label, index) => {
      pipeline[label] = pipelineRows[index].map(mapCandidate);
    });

    const candidates = applicantRows.map(mapCandidate);
    const sourceData = sourceGroups
      .map((row) => ({
        name: row.source?.trim() || "Other",
        value: row._count._all,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((row, index) => ({
        ...row,
        color: SOURCE_COLORS[index] ?? "#D4D4D8",
      }));

    const nonRejected =
      [...countByStage.entries()]
        .filter(([stage]) => stage !== "rejected")
        .reduce((sum, [, n]) => sum + n, 0);
    const interviewCount =
      (countByStage.get("interview") ?? 0) +
      (countByStage.get("technical") ?? 0) +
      (countByStage.get("offer") ?? 0) +
      (countByStage.get("hired") ?? 0);
    const hired = countByStage.get("hired") ?? 0;
    const offered = (countByStage.get("offer") ?? 0) + hired;

    return {
      ok: true,
      data: {
        jobs: mappedJobs,
        candidates,
        pipeline,
        interviews: interviewRows.map((c) => {
          const mapped = mapCandidate(c);
          return {
            candidate: mapped.name,
            type: mapped.interviewType || "Interview",
            time: mapped.interviewAt
              ? new Date(mapped.interviewAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—",
            interviewer: mapped.interviewer || "—",
          };
        }),
        sourceData:
          sourceData.length > 0
            ? sourceData
            : [{ name: "No data", value: 1, color: "#D4D4D8" }],
        activities: activityRows.map((c) => {
          const mapped = mapCandidate(c);
          return {
            desc: `${mapped.name} is in ${mapped.stage}`,
            user: "HR Recruiting",
            time: mapped.date,
          };
        }),
        stats: {
          openPositions: mappedJobs.filter((j) => j.status === "Active").length,
          totalApplicants: nonRejected,
          interviewRate:
            nonRejected === 0 ? "0%" : `${Math.round((interviewCount / nonRejected) * 100)}%`,
          offerAcceptance: offered === 0 ? "0%" : `${Math.round((hired / offered) * 100)}%`,
        },
        applicantsPage: page,
        applicantsPageSize: pageSize,
        applicantsTotal,
        applicantsTotalPages: totalPagesFor(applicantsTotal, pageSize),
      },
    };
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
    revalidateTag("recruitment", "max");
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
    revalidateTag("recruitment", "max");
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
    revalidateTag("recruitment", "max");
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
    revalidateTag("recruitment", "max");
    return { ok: true, data: mapCandidate(updated) };
  } catch (error) {
    return {
      ok: false,
      error: actionErrorMessage(error, "Could not schedule interview."),
    };
  }
}
