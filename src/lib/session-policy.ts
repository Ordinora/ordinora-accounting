export const SESSION_ABSOLUTE_LENGTH_MS = 8 * 60 * 60 * 1000;
export const SESSION_IDLE_LENGTH_MS = 30 * 60 * 1000;
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function isSessionActive(input: {
  now: Date;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
}) {
  return !input.revokedAt
    && input.expiresAt.getTime() > input.now.getTime()
    && input.lastSeenAt.getTime() > input.now.getTime() - SESSION_IDLE_LENGTH_MS;
}

export function shouldTouchSession(lastSeenAt: Date, now: Date) {
  return lastSeenAt.getTime() <= now.getTime() - SESSION_TOUCH_INTERVAL_MS;
}
