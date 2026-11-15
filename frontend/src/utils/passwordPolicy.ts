/**
 * Password limits shared by the sign-up, reset, profile and setup forms.
 * They mirror the backend policy in `backend/app/api/v1/users/schemas.py`.
 */

/** bcrypt only uses the first 72 bytes of a password, so longer ones are rejected. */
export const PASSWORD_MAX_BYTES = 72;

/** Size of the password in UTF-8 bytes (accented letters and emoji take more than one). */
export function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).length;
}

/** True when the password is longer than bcrypt can use. */
export function exceedsPasswordMaxBytes(password: string): boolean {
  return passwordByteLength(password) > PASSWORD_MAX_BYTES;
}
