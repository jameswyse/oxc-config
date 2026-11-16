import { ruleTester } from "../shared/rule-tester.ts";
import { noDroppedErrorCause } from "./no-dropped-error-cause.ts";

const effect = 'import { Effect } from "effect";\n';
const dropped = { messageId: "dropped" };

ruleTester.run("no-dropped-error-cause", noDroppedErrorCause, {
  valid: [
    effect + "read.pipe(Effect.mapError((cause) => new ReadError({ cause })));",
    effect + "read.pipe(Effect.mapError(({ message }) => new ReadError({ message })));",
    effect + 'read.pipe(Effect.catchTag("NotFound", () => Effect.fail(new Missing())));',
    effect + "read.pipe(Effect.catch(() => Effect.succeed(fallback)));",
    effect + "read.pipe(Effect.mapError(toReadError));",
    effect + "read.pipe(Effect.mapError(() => reason));",
    effect +
      "read.pipe(Effect.tapError(Effect.logError), Effect.mapError(() => new PublicError()));",
    effect +
      "read.pipe(Effect.tapCause((cause) => Effect.logError(cause)), Effect.catch(() => Effect.fail(new PublicError())));",
    effect +
      "read.pipe(Effect.catchIf((error) => error.retryable, (error) => Effect.fail(error)));",
    "read.pipe(Effect.mapError(() => new ReadError()));",
    'import { Effect } from "./effect";\nread.pipe(Effect.mapError(() => new ReadError()));',
  ],
  invalid: [
    {
      code:
        effect +
        "read.pipe(Effect.tapError(Effect.logError), Effect.flatMap(() => write), Effect.mapError(() => new PublicError()));",
      errors: [dropped],
    },
    {
      code:
        effect +
        "read.pipe(Effect.tapError(() => Effect.void), Effect.mapError(() => new PublicError()));",
      errors: [dropped],
    },
    {
      code:
        effect +
        'read.pipe(Effect.tapErrorTag("NotFound", Effect.logError), Effect.mapError(() => new PublicError()));',
      errors: [dropped],
    },
    {
      code: effect + "read.pipe(Effect.mapError(() => new ReadError()));",
      errors: [dropped],
    },
    {
      code: effect + "read.pipe(Effect.mapError((_error) => ReadError.make({ path })));",
      errors: [dropped],
    },
    {
      code: effect + "Effect.mapError(read, function () { return new ReadError(); });",
      errors: [dropped],
    },
    {
      code: effect + "read.pipe(Effect.catch(() => Effect.fail(new ReadError())));",
      errors: [dropped],
    },
    {
      code:
        effect +
        "read.pipe(Effect.catchIf(isTransient, () => { return Effect.fail(new Unavailable()); }));",
      errors: [dropped],
    },
    {
      code:
        effect +
        "read.pipe(Effect.mapError(() => { if (offline) { return new Offline(); } return new Other(); }));",
      errors: [dropped, dropped],
    },
    {
      code:
        effect +
        "read.pipe(Effect.catchIf(isTransient, () => Effect.fail(new Unavailable()), (error) => Effect.fail(error)));",
      errors: [dropped],
    },
    {
      code: effect + "read.pipe(Effect.mapErrorEager(() => new ReadError()));",
      errors: [dropped],
    },
    {
      code: effect + "read.pipe(Effect.map(format), Effect.mapError(() => new ReadError()));",
      errors: [dropped],
    },
    {
      code: 'import * as Effect from "effect/Effect";\nread.pipe(Effect.catchCause(() => Effect.fail(new ReadError())));',
      errors: [dropped],
    },
  ],
});
