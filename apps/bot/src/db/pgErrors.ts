export function pgErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let i = 0; i < 6; i++) {
    if (current && typeof current === "object" && "code" in current) {
      const code = (current as { code: unknown }).code;
      if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    }
    if (current && typeof current === "object" && "cause" in current) {
      current = (current as { cause: unknown }).cause;
      continue;
    }
    break;
  }
  return undefined;
}

export function isExclusionViolation(err: unknown): boolean {
  return pgErrorCode(err) === "23P01";
}

export function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === "23505";
}
