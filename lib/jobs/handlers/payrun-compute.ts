import { prisma } from "@/lib/db";
import { computePayslip } from "@/lib/payroll/compute";
import { payslipWarning } from "@/lib/payroll/warnings";
import { stubHasContract, stubWage } from "@/lib/payroll/period-wage";
import { stubWorkedDays, unpaidDaysInPeriod, weekdayCount } from "@/lib/payroll/worked-days";
import { toDateKey } from "@/lib/shared/dates";
import { revalidatePath, revalidateTag } from "next/cache";

type SalaryCategory = "basic" | "allowance" | "gross" | "deduction" | "net" | "contribution";

function revalidatePayroll(payrunId?: string) {
  revalidatePath("/admin/hr/payroll");
  revalidatePath("/admin/hr/payroll/payslips");
  revalidatePath("/admin");
  revalidatePath("/employee/payroll");
  revalidateTag("payroll", "max");
  if (payrunId) revalidatePath(`/admin/hr/payroll/${payrunId}`);
}

export async function runPayrunComputeJob(payrunId: string, jobId?: string) {
  if (!payrunId) throw new Error("payrunId is required");

  const payrun = await prisma.payrun.findUnique({
    where: { id: payrunId },
    include: {
      structure: { include: { rules: { orderBy: { sequence: "asc" } } } },
      payslips: {
        include: {
          employee: {
            include: {
              user: {
                select: {
                  id: true,
                  payrolls: { orderBy: { month: "desc" }, take: 1, select: { basic: true } },
                  leaveRequests: {
                    select: {
                      type: { select: { code: true } },
                      status: true,
                      startDate: true,
                      endDate: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!payrun) throw new Error("Payrun not found.");
  if (payrun.status === "paid") throw new Error("Paid payruns cannot be recomputed.");

  const periodStart = toDateKey(payrun.periodStart);
  const periodEnd = toDateKey(payrun.periodEnd);
  const scheduledDays = weekdayCount(periodStart, periodEnd);
  const employeeIds = payrun.payslips.map((slip) => slip.employeeId);
  const duplicateRows =
    employeeIds.length === 0
      ? []
      : await prisma.payslip.findMany({
          where: {
            employeeId: { in: employeeIds },
            id: { notIn: payrun.payslips.map((slip) => slip.id) },
            payrun: {
              id: { not: payrun.id },
              periodStart: payrun.periodStart,
              periodEnd: payrun.periodEnd,
            },
          },
          select: { employeeId: true },
        });
  const duplicateEmployeeIds = new Set(duplicateRows.map((row) => row.employeeId));
  const total = payrun.payslips.length;
  let index = 0;

  for (const slip of payrun.payslips) {
    index += 1;
    if (jobId) {
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: { progressCurrent: index, progressTotal: total },
      });
    }

    const wage = stubWage(slip.employee.wage, slip.employee.user.payrolls[0]?.basic);
    const unpaidLeaveDays = unpaidDaysInPeriod(
      periodStart,
      periodEnd,
      slip.employee.user.leaveRequests.map((leave) => ({
        type: leave.type.code,
        status: leave.status,
        startDate: toDateKey(leave.startDate),
        endDate: toDateKey(leave.endDate),
      })),
    );
    const workedDays = stubWorkedDays(scheduledDays, unpaidLeaveDays);
    const warning = payslipWarning({
      bankAccount: slip.employee.bankAccount,
      hasContract: stubHasContract(wage),
      duplicateInOtherPayrun: duplicateEmployeeIds.has(slip.employeeId),
    });

    let gross = 0;
    let net = 0;
    let lines: { name: string; code: string; category: SalaryCategory; amount: number; ruleId: string }[] =
      [];
    if (stubHasContract(wage) && payrun.structure.rules.length > 0) {
      const computed = computePayslip(
        payrun.structure.rules.map((rule) => ({
          name: rule.name,
          code: rule.code,
          category: rule.category,
          sequence: rule.sequence,
          computation: rule.computation,
          amount: rule.amount == null ? undefined : Number(rule.amount),
          percentage: rule.percentage == null ? undefined : Number(rule.percentage),
          percentBaseCode: rule.percentBaseCode ?? undefined,
          formula: rule.formula ?? undefined,
        })),
        { wage, workedDays, scheduledDays, unpaidLeaveDays },
      );
      gross = computed.gross;
      net = computed.net;
      lines = computed.lines.map((line) => ({
        ...line,
        ruleId: payrun.structure.rules.find((rule) => rule.code === line.code)?.id ?? "",
      }));
    }

    await prisma.$transaction([
      prisma.payslipLine.deleteMany({ where: { payslipId: slip.id } }),
      prisma.payslip.update({
        where: { id: slip.id },
        data: {
          workedDays,
          wage,
          gross,
          net,
          warning,
          status: "computed",
          lines: {
            create: lines.map((line) => ({
              ruleId: line.ruleId || null,
              name: line.name,
              code: line.code,
              category: line.category,
              amount: line.amount,
            })),
          },
        },
      }),
    ]);
  }

  await prisma.payrun.update({ where: { id: payrunId }, data: { status: "computed" } });
  revalidatePayroll(payrunId);
  return { payrunId, slips: total };
}
