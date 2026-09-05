export function payslipWarning(input: {
  bankAccount: string | null | undefined;
  hasContract: boolean;
  duplicateInOtherPayrun: boolean;
}) {
  if (!input.hasContract) return "No contract for this period";
  if (!input.bankAccount?.trim()) return "A/C missing";
  if (input.duplicateInOtherPayrun) return "Duplicate";
  return null;
}
