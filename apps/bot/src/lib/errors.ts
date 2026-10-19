export const DOMAIN_ERROR_CODES = [
  "SLOT_TAKEN",
  "SLOT_TOO_SOON",
  "SLOT_INVALID",
  "INACTIVE",
  "LIMIT_ACTIVE",
  "CUTOFF",
  "RESCHEDULE_LIMIT",
  "NOT_FOUND",
  "FORBIDDEN",
  "SANDBOX_DENIED",
  "PROTECTED_ITEM",
  "HOLD_EXPIRED",
  "COOLDOWN",
  "AI_DISABLED",
  "AI_LIMIT_USER",
  "AI_LIMIT_GLOBAL",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly meta: Record<string, unknown>;

  constructor(code: DomainErrorCode, meta: Record<string, unknown> = {}) {
    super(code);
    this.name = "DomainError";
    this.code = code;
    this.meta = meta;
  }
}

const SPEC_KEYS: Partial<Record<DomainErrorCode, string>> = {
  SLOT_TAKEN: "slot-taken",
  SLOT_TOO_SOON: "slot-too-soon",
  LIMIT_ACTIVE: "limit-active",
  CUTOFF: "cutoff",
  HOLD_EXPIRED: "hold-expired",
  SANDBOX_DENIED: "sandbox-denied",
  PROTECTED_ITEM: "protected-item",
  AI_DISABLED: "ai-disabled",
  AI_LIMIT_USER: "ai-limit-user",
  AI_LIMIT_GLOBAL: "ai-limit-global",
};

export function errorKey(code: DomainErrorCode): string {
  return SPEC_KEYS[code] ?? `error-${code.toLowerCase().replaceAll("_", "-")}`;
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}
