import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/\d/, "Password must include at least one number.");

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

export const signUpSchema = z
  .object({
    name: z.string().min(2, "Full name is required."),
    organizationName: z.string().min(2, "Organization name is required."),
    organizationEmail: z.string().email("Enter a valid organization email."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"],
  });

export const createEmployeeSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  email: z.string().email("Enter a valid email."),
  role: z.enum(["admin", "hr_manager", "hr_payroll_user", "hr_payroll_manager", "employee"]),
  department: z.string().min(1, "Department is required."),
  jobTitle: z.string().min(1, "Job title is required."),
  phone: z.string().optional(),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(2, "Department name is required.").max(80),
  code: z
    .string()
    .max(32)
    .optional()
    .transform((value) => value?.trim() || undefined),
});

export const renameDepartmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Department name is required.").max(80),
});

export const updateEmployeeSchema = z.object({
  employeeId: z.string().min(1),
  fullName: z.string().min(2, "Full name is required."),
  departmentId: z.string().min(1, "Department is required."),
  managerId: z.string().optional().nullable(),
  scheduleId: z.string().optional().nullable(),
  jobTitle: z.string().min(1, "Job title is required."),
  companyName: z.string().optional().nullable(),
  workLocation: z.string().optional().nullable(),
  employeeType: z.enum(["full_time", "intern", "contractor"]),
  status: z.enum(["active", "inactive", "on_leave"]),
  phone: z.string().optional().nullable(),
  personalEmail: z
    .union([z.string().email("Enter a valid personal email."), z.literal(""), z.null()])
    .optional(),
  address: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable(),
  joinDate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Join date must be YYYY-MM-DD."), z.literal(""), z.null()])
    .optional(),
});

export const upsertContractSchema = z
  .object({
    id: z.string().optional(),
    employeeProfileId: z.string().min(1, "Employee is required."),
    departmentId: z.string().optional().nullable(),
    scheduleId: z.string().optional().nullable(),
    salaryStructureId: z.string().optional().nullable(),
    jobTitle: z.string().min(1, "Position is required."),
    wage: z.number().positive("Wage must be greater than 0."),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required."),
    endDate: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
      .optional(),
    status: z.enum(["running", "expired"]),
    notes: z.string().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const end = value.endDate && value.endDate.length > 0 ? value.endDate : null;
    if (end && end < value.startDate) {
      ctx.addIssue({
        code: "custom",
        message: "End date cannot be before start date.",
        path: ["endDate"],
      });
    }
  });

export const scheduleLineSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  startMin: z.number().int().min(0).max(24 * 60 - 1),
  endMin: z.number().int().min(1).max(24 * 60),
  breakMin: z.number().int().min(0).max(12 * 60),
});

export const upsertScheduleSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(2, "Schedule name is required.").max(80),
    calendarType: z.enum(["fixed", "variable"]),
    timezone: z.string().min(1).default("Asia/Kolkata"),
    active: z.boolean().default(true),
    lines: z.array(scheduleLineSchema).min(1, "Add at least one working day."),
  })
  .superRefine((value, ctx) => {
    for (const [index, line] of value.lines.entries()) {
      if (line.endMin <= line.startMin) {
        ctx.addIssue({
          code: "custom",
          message: "End time must be after start time.",
          path: ["lines", index, "endMin"],
        });
      }
    }
  });

export const applyLeaveSchema = z.object({
  type: z.enum(["paid", "sick", "unpaid"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date is required."),
  remarks: z.string().min(3, "Add a brief reason."),
  allocationId: z.string().optional().nullable(),
});

export const decideLeaveSchema = z.object({
  leaveId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  adminComment: z.string().min(1, "Add a comment for the employee."),
});

export const copilotQuestionSchema = z.object({
  question: z.string().trim().min(3, "Enter a question.").max(500, "Keep questions under 500 characters."),
});

export const upsertPayrollSchema = z.object({
  userId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM."),
  basic: z.number().positive("Basic pay must be greater than 0."),
  hraPct: z.number().min(0, "HRA cannot be negative.").max(100),
  allowancePct: z.number().min(0, "Allowance cannot be negative.").max(100),
  deductions: z.number().min(0, "Deductions cannot be negative."),
});

export function firstZodError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid input.";
}
