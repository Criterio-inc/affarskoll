// Skydd mot mass-tilldelning i skrivande API-rutter. Tar bort fält som en
// klient aldrig ska få sätta direkt (id, ägare, tidsstämplar, soft-delete).
// Rutten sätter userId själv efter auth.

const PROTECTED_KEYS = [
  "id",
  "userId",
  "user_id",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
  "deletedAt",
  "deleted_at",
];

export function stripProtected<T extends Record<string, unknown>>(
  body: T
): T {
  const clone: Record<string, unknown> = { ...body };
  for (const key of PROTECTED_KEYS) delete clone[key];
  return clone as T;
}
