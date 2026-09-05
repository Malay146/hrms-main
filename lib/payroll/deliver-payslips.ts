import { prisma } from "@/lib/db";
import { logger } from "@/lib/shared/logger";
import { sendPayslipEmail } from "@/lib/shared/mail";
import { createNotifications } from "@/lib/shared/notify";
import { dateFromKey, payrollMonthRange, payslipIssueMonth, toDateKey } from "@/lib/shared/dates";
import type { PayslipEmailInput } from "@/lib/shared/payslip-email";

export const payslipEmailInclude = {
  lines: true,
  employee: {
    include: {
      user: { select: { email: true } },
      department: { select: { name: true } },
    },
  },
  payrun: { include: { structure: { select: { name: true } } } },
} as const;

type PayslipEmailRow = {
  id: string;
  sentAt: Date | null;
  status: string;
  lines: { name: string; code: string; category: string; amount: unknown }[];
  employee: {
    userId: string;
    fullName: string;
    employeeId: string;
    department: { name: string };
    user: { email: string };
  };
  payrun: {
    periodStart: Date;
    periodEnd: Date;
    status: string;
    structure: { name: string };
  };
  workedDays: unknown;
  gross: unknown;
  net: unknown;
};

function money(value: unknown) {
  return Number(value ?? 0);
}

export function toPayslipEmailInput(slip: PayslipEmailRow): PayslipEmailInput & { to: string } {
  const periodStart = toDateKey(slip.payrun.periodStart);
  const periodEnd = toDateKey(slip.payrun.periodEnd);
  return {
    to: slip.employee.user.email,
    fullName: slip.employee.fullName,
    employeeCode: slip.employee.employeeId,
    department: slip.employee.department.name,
    periodLabel: `${periodStart} – ${periodEnd}`,
    periodStart,
    periodEnd,
    structureName: slip.payrun.structure.name,
    workedDays: money(slip.workedDays),
    gross: money(slip.gross),
    net: money(slip.net),
    lines: slip.lines.map((line) => ({
      name: line.name,
      code: line.code,
      category: line.category,
      amount: money(line.amount),
    })),
  };
}

export async function deliverUnsentPayslip(slip: PayslipEmailRow): Promise<"sent" | "skipped" | "failed"> {
  if (slip.status !== "validated" && slip.status !== "paid") return "skipped";
  if (slip.payrun.status !== "validated" && slip.payrun.status !== "paid") return "skipped";
  if (slip.sentAt) return "skipped";
  try {
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId: slip.employee.userId },
      select: { emailPayroll: true },
    });
    const wantsEmail = pref?.emailPayroll !== false;
    if (wantsEmail) {
      await sendPayslipEmail(toPayslipEmailInput(slip));
    }
    await prisma.payslip.update({ where: { id: slip.id }, data: { sentAt: new Date() } });
    await createNotifications({
      userIds: [slip.employee.userId],
      title: "Payslip ready",
      body: wantsEmail
        ? `Your payslip for ${toDateKey(slip.payrun.periodStart)} – ${toDateKey(slip.payrun.periodEnd)} has been emailed.`
        : `Your payslip for ${toDateKey(slip.payrun.periodStart)} – ${toDateKey(slip.payrun.periodEnd)} is ready.`,
      category: "payroll",
      href: "/employee/payroll",
    });
    return "sent";
  } catch (error) {
    logger.info("payrun.payslip_email_failed", { payslipId: slip.id, error: String(error) });
    return "failed";
  }
}

export async function emailPayslipNow(slip: PayslipEmailRow) {
  await sendPayslipEmail(toPayslipEmailInput(slip));
  await prisma.payslip.update({ where: { id: slip.id }, data: { sentAt: new Date() } });
  await createNotifications({
    userIds: [slip.employee.userId],
    title: "Payslip ready",
    body: `Your payslip for ${toDateKey(slip.payrun.periodStart)} – ${toDateKey(slip.payrun.periodEnd)} has been emailed.`,
    category: "payroll",
    href: "/employee/payroll",
  });
}

export async function issueMonthEndPayslips(month = payslipIssueMonth()) {
  const { start, end } = payrollMonthRange(month);
  const slips = await prisma.payslip.findMany({
    where: {
      status: { in: ["validated", "paid"] },
      payrun: {
        status: { in: ["validated", "paid"] },
        periodEnd: { gte: dateFromKey(start), lte: dateFromKey(end) },
      },
    },
    include: payslipEmailInclude,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const slip of slips) {
    const result = await deliverUnsentPayslip(slip);
    if (result === "sent") sent += 1;
    else if (result === "failed") failed += 1;
    else skipped += 1;
  }
  return { month, sent, failed, skipped };
}
