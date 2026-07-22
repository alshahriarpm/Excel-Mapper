/**
 * Password policy. Real passwords are hashed by Supabase Auth — this is just a
 * minimum-length check at account-creation time (used client-side for UX and
 * server-side as the source of truth).
 *
 * Policy: minimum 6 characters, no maximum, no composition rules.
 */
export const MIN_PASSWORD_LENGTH = 6;

/** Returns an error message if the password is too short, otherwise null. */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
