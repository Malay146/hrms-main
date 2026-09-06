export function statusForActionError(error: string) {
  if (/too many requests/i.test(error)) return 429;
  if (/sign in|session expired/i.test(error)) return 401;
  if (/do not have access|permission/i.test(error)) return 403;
  if (/not found/i.test(error)) return 404;
  return 400;
}
