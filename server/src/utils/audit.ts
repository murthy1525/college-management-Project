import { Queryable } from "../config/db";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "STATUS_CHANGE"
  | "UPLOAD_DOCUMENT"
  | "VIEW_DOCUMENT";

export interface AuditEntry {
  userId: number;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

/** Single write path for every audit record, so the shape and the
 * before/after redaction policy can't drift between modules. */
export async function recordAudit(db: Queryable, entry: AuditEntry): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json, reason)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
    [
      entry.userId,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.before !== undefined ? JSON.stringify(redact(entry.before)) : null,
      entry.after !== undefined ? JSON.stringify(redact(entry.after)) : null,
      entry.reason ?? null,
    ]
  );
}

const REDACTED_KEYS = new Set(["password_hash", "password", "token", "refresh_token"]);

function redact(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  const clone: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const key of Object.keys(clone)) {
    if (REDACTED_KEYS.has(key)) clone[key] = "[REDACTED]";
  }
  return clone;
}
