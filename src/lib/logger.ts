/**
 * Central error logging.
 * Always logs to the console. Additionally forwards to Sentry when
 * VITE_SENTRY_DSN is configured (loaded dynamically so the bundle stays small
 * when no DSN is present).
 */

type Meta = Record<string, unknown>;

let sentryPromise: Promise<typeof import("@sentry/react")> | null = null;
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

const loadSentry = () => {
  if (!dsn) return null;
  if (!sentryPromise) {
    sentryPromise = import("@sentry/react")
      .then((Sentry) => {
        Sentry.init({ dsn, environment: import.meta.env.MODE, tracesSampleRate: 0 });
        return Sentry;
      })
      .catch((err) => {
        console.warn("[logger] Sentry unavailable", err);
        throw err;
      });
  }
  return sentryPromise;
};

export const logError = (scope: string, err: unknown, meta?: Meta) => {
  console.error(`[${scope}]`, err, meta ?? "");
  const pending = loadSentry();
  if (!pending) return;
  void pending
    .then((Sentry) =>
      Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
        tags: { scope },
        extra: meta,
      })
    )
    .catch(() => {
      /* already warned */
    });
};

export const logEvent = (scope: string, message: string, meta?: Meta) => {
  if (import.meta.env.DEV) console.info(`[${scope}] ${message}`, meta ?? "");
};

/** Extract a safe, user-facing message from an unknown error. */
export const toUserMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message && !/firebase|firestore|internal/i.test(err.message)) {
    return err.message;
  }
  return fallback;
};
