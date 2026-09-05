"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionErrorMessage, requirePermission, requireUser } from "@/lib/auth/session";
import { firstZodError } from "@/lib/shared/validations";
import { hasPermission } from "@/lib/auth/permissions";
import { REGULAR_SALARY_RULES } from "@/lib/payroll/regular-salary";
import type { ActionResult } from "@/lib/shared/types";
import type { RuleComputation, SalaryCategory } from "@/lib/payroll/compute";
import { z } from "zod";

const structureSchema = z.object({
  name: z.string().trim().min(2, "Structure name is required."),
  active: z.boolean().optional(),
});

const ruleSchema = z.object({
  structureId: z.string().min(1),
  name: z.string().trim().min(2),
  code: z.string().trim().min(1).max(20),
  category: z.enum(["basic", "allowance", "gross", "deduction", "net", "contribution"]),
  sequence: z.number().int().min(1),
  computation: z.enum([
    "fixed",
    "percent_of_wage",
    "percent_of_basic",
    "percent_of_gross",
    "percent_of_category",
    "formula",
  ]),
  amount: z.number().optional(),
  percentage: z.number().optional(),
  percentBaseCode: z.string().optional(),
  formula: z.string().optional(),
});

export type SalaryStructureListItem = {
  id: string;
  name: string;
  active: boolean;
  ruleCount: number;
  employeeCount: number;
};

export type SalaryRuleListItem = {
  id: string;
  structureId: string;
  structureName: string;
  name: string;
  code: string;
  category: SalaryCategory;
  sequence: number;
  computation: RuleComputation;
  amount: number | null;
  percentage: number | null;
  percentBaseCode: string | null;
  formula: string | null;
};

function revalidateSalary() {
  revalidatePath("/admin/hr/payroll/structures");
  revalidatePath("/admin/hr/payroll/rules");
  revalidatePath("/admin/hr/payroll");
}

async function organizationIdFor(userId: string) {
  const profile = await prisma.employeeProfile.findUnique({
    where: { userId },
    select: { organizationId: true },
  });
  if (!profile) throw new Error("No organization found for this user.");
  return profile.organizationId;
}

export async function listSalaryStructures(): Promise<ActionResult<SalaryStructureListItem[]>> {
  try {
    await requirePermission("viewSalaryConfig");
    const rows = await prisma.salaryStructure.findMany({
      include: {
        _count: { select: { rules: true, payruns: true } },
      },
      orderBy: { name: "asc" },
    });
    return {
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        active: row.active,
        ruleCount: row._count.rules,
        employeeCount: row._count.payruns,
      })),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load salary structures.") };
  }
}

export async function getSalaryStructure(id: string): Promise<ActionResult<SalaryStructureListItem & { rules: SalaryRuleListItem[] }>> {
  try {
    await requirePermission("viewSalaryConfig");
    const row = await prisma.salaryStructure.findUnique({
      where: { id },
      include: {
        rules: { orderBy: { sequence: "asc" } },
        _count: { select: { rules: true, payruns: true } },
      },
    });
    if (!row) return { ok: false, error: "Salary structure not found." };
    return {
      ok: true,
      data: {
        id: row.id,
        name: row.name,
        active: row.active,
        ruleCount: row._count.rules,
        employeeCount: row._count.payruns,
        rules: row.rules.map((rule) => mapRule(rule, row.name)),
      },
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load salary structure.") };
  }
}

export async function saveSalaryStructureAction(input: {
  id?: string;
  name: string;
  active?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("manageSalaryConfig");
    const parsed = structureSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };
    const user = await requireUser();
    const organizationId = await organizationIdFor(user.id);

    const saved = input.id
      ? await prisma.salaryStructure.update({
          where: { id: input.id },
          data: { name: parsed.data.name, active: parsed.data.active ?? true },
        })
      : await prisma.salaryStructure.create({
          data: {
            organizationId,
            name: parsed.data.name,
            active: parsed.data.active ?? true,
          },
        });

    revalidateSalary();
    return { ok: true, data: { id: saved.id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save salary structure.") };
  }
}

export async function deleteSalaryStructureAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("manageSalaryConfig");
    const existing = await prisma.salaryStructure.findUnique({
      where: { id },
      include: { _count: { select: { payruns: true } } },
    });
    if (!existing) {
      return { ok: false, error: "Salary structure not found." };
    }
    if (existing._count.payruns > 0) {
      return {
        ok: false,
        error: "Cannot delete a structure that is used by payruns. Deactivate it instead.",
      };
    }

    await prisma.$transaction([
      prisma.contract.updateMany({
        where: { salaryStructureId: id },
        data: { salaryStructureId: null },
      }),
      prisma.salaryStructure.delete({ where: { id } }),
    ]);

    revalidateSalary();
    return { ok: true, data: { id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not delete salary structure.") };
  }
}

export async function listSalaryRules(structureId?: string): Promise<ActionResult<SalaryRuleListItem[]>> {
  try {
    await requirePermission("viewSalaryConfig");
    const rows = await prisma.salaryRule.findMany({
      where: structureId ? { structureId } : undefined,
      include: { structure: { select: { name: true } } },
      orderBy: [{ structureId: "asc" }, { sequence: "asc" }],
    });
    return {
      ok: true,
      data: rows.map((row) => mapRule(row, row.structure.name)),
    };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not load salary rules.") };
  }
}

export async function saveSalaryRuleAction(input: {
  id?: string;
  structureId: string;
  name: string;
  code: string;
  category: SalaryCategory;
  sequence: number;
  computation: RuleComputation;
  amount?: number;
  percentage?: number;
  percentBaseCode?: string;
  formula?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("manageSalaryConfig");
    const parsed = ruleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) };

    const data = {
      structureId: parsed.data.structureId,
      name: parsed.data.name,
      code: parsed.data.code.toUpperCase(),
      category: parsed.data.category,
      sequence: parsed.data.sequence,
      computation: parsed.data.computation,
      amount: parsed.data.amount ?? null,
      percentage: parsed.data.percentage ?? null,
      percentBaseCode: parsed.data.percentBaseCode || null,
      formula: parsed.data.formula || null,
    };

    const saved = input.id
      ? await prisma.salaryRule.update({ where: { id: input.id }, data })
      : await prisma.salaryRule.create({ data });

    revalidateSalary();
    return { ok: true, data: { id: saved.id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not save salary rule.") };
  }
}

export async function deleteSalaryRuleAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("manageSalaryConfig");
    const existing = await prisma.salaryRule.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return { ok: false, error: "Salary rule not found." };
    }
    await prisma.salaryRule.delete({ where: { id } });
    revalidateSalary();
    return { ok: true, data: { id } };
  } catch (error) {
    return { ok: false, error: actionErrorMessage(error, "Could not delete salary rule.") };
  }
}

export async function ensureRegularSalaryStructure(organizationId: string) {
  const existing = await prisma.salaryStructure.findFirst({
    where: { organizationId, name: "Regular Salary" },
  });
  if (existing) return existing.id;

  const created = await prisma.salaryStructure.create({
    data: {
      organizationId,
      name: "Regular Salary",
      active: true,
      rules: {
        create: REGULAR_SALARY_RULES.map((rule) => ({
          name: rule.name,
          code: rule.code,
          category: rule.category,
          sequence: rule.sequence,
          computation: rule.computation,
          amount: rule.amount ?? null,
          percentage: rule.percentage ?? null,
          percentBaseCode: rule.percentBaseCode ?? null,
          formula: rule.formula ?? null,
        })),
      },
    },
  });
  return created.id;
}

export async function canManageSalaryConfig() {
  const user = await requireUser();
  return hasPermission(user.role, "manageSalaryConfig");
}

function mapRule(
  rule: {
    id: string;
    structureId: string;
    name: string;
    code: string;
    category: SalaryCategory;
    sequence: number;
    computation: RuleComputation;
    amount: unknown;
    percentage: unknown;
    percentBaseCode: string | null;
    formula: string | null;
  },
  structureName: string,
): SalaryRuleListItem {
  return {
    id: rule.id,
    structureId: rule.structureId,
    structureName,
    name: rule.name,
    code: rule.code,
    category: rule.category,
    sequence: rule.sequence,
    computation: rule.computation,
    amount: rule.amount == null ? null : Number(rule.amount),
    percentage: rule.percentage == null ? null : Number(rule.percentage),
    percentBaseCode: rule.percentBaseCode,
    formula: rule.formula,
  };
}
