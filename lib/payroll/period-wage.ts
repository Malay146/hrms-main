export function stubWage(wage: unknown, payrollBasic: unknown) {
  const fromProfile = Number(wage ?? 0);
  if (fromProfile > 0) return fromProfile;
  const fromPayroll = Number(payrollBasic ?? 0);
  return fromPayroll > 0 ? fromPayroll : 0;
}

export function stubHasContract(wage: number) {
  return wage > 0;
}
