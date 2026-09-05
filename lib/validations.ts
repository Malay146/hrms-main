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

export const applyLeaveSchema = z.object({
  type: z.enum(["paid", "sick", "unpaid"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date is required."),
  remarks: z.string().min(3, "Add a brief reason."),
});

export const decideLeaveSchema = z.object({
  leaveId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  adminComment: z.string().min(1, "Add a comment for the employee."),
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
