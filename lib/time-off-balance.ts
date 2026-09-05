export function remaining(allocated: number, taken: number) {
  return Math.round((allocated - taken) * 100) / 100;
}

export function canSubmitRequest(input: {
  requiresAllocation: boolean;
  remaining: number;
  duration: number;
  allocationStatus: "draft" | "approved" | "refused";
}) {
  if (!input.requiresAllocation) return null;
  if (input.allocationStatus !== "approved") {
    return "This leave type needs an approved allocation before you can request time off.";
  }
  if (input.duration > input.remaining) {
    return "Not enough remaining balance on the selected allocation.";
  }
  return null;
}

export function takenAfterApproval(taken: number, duration: number) {
  return Math.round((taken + duration) * 100) / 100;
}

export function takenAfterRefusal(taken: number, duration: number) {
  return Math.round(Math.max(0, taken - duration) * 100) / 100;
}
