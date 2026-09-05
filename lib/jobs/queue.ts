import { prisma } from "@/lib/db";
import { logger } from "@/lib/shared/logger";
import type { BackgroundJobType, Prisma } from "@/generated/prisma/client";
import { runPayrunComputeJob } from "@/lib/jobs/handlers/payrun-compute";
import { runAiSnapshotRebuildJob } from "@/lib/jobs/handlers/ai-snapshot";
import { runAttendanceRollupBackfillJob } from "@/lib/jobs/handlers/attendance-rollup";

const STALE_LOCK_MS = 15 * 60_000;

export type EnqueueInput = {
  organizationId: string;
  type: BackgroundJobType;
  payload: Prisma.InputJsonValue;
  createdByUserId?: string | null;
};

export async function enqueueBackgroundJob(input: EnqueueInput) {
  return prisma.backgroundJob.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      status: "queued",
      payload: input.payload,
      createdByUserId: input.createdByUserId ?? null,
    },
  });
}

async function claimNextJob(workerId: string) {
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
  const candidate = await prisma.backgroundJob.findFirst({
    where: {
      OR: [
        { status: "queued" },
        { status: "running", lockedAt: { lt: staleBefore } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const updated = await prisma.backgroundJob.updateMany({
    where: {
      id: candidate.id,
      OR: [
        { status: "queued" },
        { status: "running", lockedAt: { lt: staleBefore } },
      ],
    },
    data: {
      status: "running",
      lockedAt: new Date(),
      lockedBy: workerId,
      attempts: { increment: 1 },
    },
  });
  if (updated.count === 0) return null;
  return prisma.backgroundJob.findUnique({ where: { id: candidate.id } });
}

async function executeJob(job: {
  id: string;
  type: BackgroundJobType;
  payload: Prisma.JsonValue;
  organizationId: string;
}) {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  switch (job.type) {
    case "payrun_compute":
      return runPayrunComputeJob(String(payload.payrunId ?? ""), job.id);
    case "ai_snapshot_rebuild":
      return runAiSnapshotRebuildJob(job.organizationId, job.id, Number(payload.periodDays ?? 30));
    case "attendance_rollup_backfill":
      return runAttendanceRollupBackfillJob(
        job.organizationId,
        String(payload.from ?? ""),
        String(payload.to ?? ""),
      );
    case "payslip_bulk_email":
    case "employee_import_chunk":
      return { skipped: true, reason: "Handler not wired in this phase" };
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

export async function processBackgroundJobs(limit = 3) {
  const workerId = `worker-${process.pid}-${Date.now()}`;
  const processed: { id: string; type: string; ok: boolean; error?: string }[] = [];

  for (let i = 0; i < limit; i += 1) {
    const job = await claimNextJob(workerId);
    if (!job) break;

    try {
      const result = await executeJob(job);
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "succeeded",
          result: result as Prisma.InputJsonValue,
          finishedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      });
      processed.push({ id: job.id, type: job.type, ok: true });
      logger.info("jobs.succeeded", { jobId: job.id, type: job.type });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          error: message.slice(0, 2000),
          finishedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
        },
      });
      processed.push({ id: job.id, type: job.type, ok: false, error: message });
      logger.error("jobs.failed", { jobId: job.id, type: job.type, error: message });
    }
  }

  return processed;
}

export async function enqueueAndRun(
  input: EnqueueInput,
  options?: { processInline?: boolean },
) {
  const job = await enqueueBackgroundJob(input);
  if (options?.processInline !== false) {
    await processBackgroundJobs(5);
  }
  const latest = await prisma.backgroundJob.findUnique({ where: { id: job.id } });
  return latest ?? job;
}
