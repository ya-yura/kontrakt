export type CronAuthorizationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: 401 | 403 | 500;
      message: string;
    };

export function validateCronAuthorization(
  authorizationHeader: string | null,
  cronSecret = process.env.CRON_SECRET
): CronAuthorizationResult {
  const expectedSecret = cronSecret?.trim();

  if (!expectedSecret) {
    return {
      ok: false,
      status: 500,
      message: "CRON_SECRET is not configured."
    };
  }

  if (!authorizationHeader) {
    return {
      ok: false,
      status: 401,
      message: "Missing Authorization bearer token."
    };
  }

  const [scheme, token] = authorizationHeader.split(/\s+/, 2);

  if (scheme.toLowerCase() !== "bearer" || !token) {
    return {
      ok: false,
      status: 401,
      message: "Expected Authorization: Bearer token."
    };
  }

  if (token !== expectedSecret) {
    return {
      ok: false,
      status: 403,
      message: "Invalid cron token."
    };
  }

  return { ok: true };
}
