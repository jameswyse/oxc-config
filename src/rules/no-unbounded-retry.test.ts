import { ruleTester } from "../shared/rule-tester.ts";
import { noUnboundedRetry } from "./no-unbounded-retry.ts";

const effect = 'import { Effect, Schedule, pipe } from "effect";\n';
const unbounded = { messageId: "unbounded" };

ruleTester.run("no-unbounded-retry", noUnboundedRetry, {
  valid: [
    effect + "Effect.timeout('2 seconds')(Effect.retry(read, Schedule.forever));",
    effect + "const policy = Schedule.min([policy]);\nEffect.retry(read, policy);",
    effect + "call.pipe(Effect.retry({ times: 3 }));",
    effect + "call.pipe(Effect.retry({ schedule: Schedule.spaced('1 second'), times: 3 }));",
    effect +
      "call.pipe(Effect.retry({ while: isTransient, schedule: Schedule.spaced('1 second') }));",
    effect +
      "call.pipe(Effect.retry(Schedule.exponential('100 millis').pipe(Schedule.upTo({ times: 5 }))));",
    effect +
      "call.pipe(Effect.retry(Schedule.spaced('1 second').pipe(Schedule.while(({ input }) => isTransient(input)))));",
    effect +
      "call.pipe(Effect.retry(Schedule.min([Schedule.spaced('1 second'), Schedule.recurs(3)])));",
    effect + "call.pipe(Effect.retry(Schedule.during('30 seconds')));",
    effect + "call.pipe(Effect.retry(Schedule.duration('1 second')));",
    effect + "call.pipe(Effect.retry(Schedule.once));",
    effect + "call.pipe(Effect.retry(Schedule.spaced('10 millis')), Effect.timeout('2 seconds'));",
    effect + "Effect.retry(call, Schedule.forever).pipe(Effect.timeout('2 seconds'));",
    effect + "pipe(call, Effect.retry(Schedule.forever), Effect.timeoutOption('2 seconds'));",
    effect + "Effect.timeout(call.pipe(Effect.retry(Schedule.forever)), '2 seconds');",
    effect + "Effect.timeout(Effect.retry(call, Schedule.forever), '2 seconds');",
    effect + "call.pipe(Effect.retry(policy));",
    effect + "call.pipe(Effect.retry(Schedule.exponential('1 second').pipe(withLimit)));",
    effect + "call.pipe(Effect.retry({ ...options }));",
    effect + "call.pipe(Effect.repeat(Schedule.spaced('1 second')));",
    'import { Effect, Schedule } from "./effect";\ncall.pipe(Effect.retry(Schedule.forever));',
  ],
  invalid: [
    {
      code:
        effect +
        "const p0 = Schedule.forever;\nconst p1 = Schedule.min([p0, p0]);\nconst p2 = Schedule.min([p1, p1]);\nconst p3 = Schedule.min([p2, p2]);\nconst p4 = Schedule.min([p3, p3]);\nconst p5 = Schedule.min([p4, p4]);\nconst p6 = Schedule.min([p5, p5]);\nconst p7 = Schedule.min([p6, p6]);\nconst p8 = Schedule.min([p7, p7]);\nconst p9 = Schedule.min([p8, p8]);\nconst p10 = Schedule.min([p9, p9]);\nconst p11 = Schedule.min([p10, p10]);\nconst p12 = Schedule.min([p11, p11]);\nconst p13 = Schedule.min([p12, p12]);\nconst p14 = Schedule.min([p13, p13]);\nconst p15 = Schedule.min([p14, p14]);\nconst p16 = Schedule.min([p15, p15]);\nconst p17 = Schedule.min([p16, p16]);\nconst p18 = Schedule.min([p17, p17]);\nconst p19 = Schedule.min([p18, p18]);\nconst p20 = Schedule.min([p19, p19]);\nconst p21 = Schedule.min([p20, p20]);\nconst p22 = Schedule.min([p21, p21]);\nconst p23 = Schedule.min([p22, p22]);\nconst p24 = Schedule.min([p23, p23]);\nconst p25 = Schedule.min([p24, p24]);\nconst p26 = Schedule.min([p25, p25]);\nconst p27 = Schedule.min([p26, p26]);\nconst p28 = Schedule.min([p27, p27]);\nconst p29 = Schedule.min([p28, p28]);\nconst p30 = Schedule.min([p29, p29]);\nconst p31 = Schedule.min([p30, p30]);\nconst p32 = Schedule.min([p31, p31]);\nconst p33 = Schedule.min([p32, p32]);\nconst p34 = Schedule.min([p33, p33]);\nconst p35 = Schedule.min([p34, p34]);\nconst p36 = Schedule.min([p35, p35]);\nconst p37 = Schedule.min([p36, p36]);\nconst p38 = Schedule.min([p37, p37]);\nconst p39 = Schedule.min([p38, p38]);\nconst p40 = Schedule.min([p39, p39]);\nEffect.retry(read, p40);",
      errors: [unbounded],
    },
    {
      code:
        effect +
        "const base = Schedule.forever;\nconst policy = base;\nEffect.retry(read, Schedule.min([policy, policy]));",
      errors: [unbounded],
    },
    { code: effect + "call.pipe(Effect.retry(Schedule.forever));", errors: [unbounded] },
    {
      code: effect + "call.pipe(Effect.retry(Schedule.exponential('100 millis')));",
      errors: [unbounded],
    },
    {
      code:
        effect +
        "call.pipe(Effect.retry(Schedule.exponential('100 millis').pipe(Schedule.jittered, Schedule.modifyDelay(cap))));",
      errors: [unbounded],
    },
    {
      code:
        effect +
        "call.pipe(Effect.retry(Schedule.min([Schedule.exponential('1 second'), Schedule.spaced('1 minute')])));",
      errors: [unbounded],
    },
    {
      code: effect + "call.pipe(Effect.retry({ schedule: Schedule.spaced('1 second') }));",
      errors: [unbounded],
    },
    {
      code:
        effect +
        "const options = { schedule: Schedule.spaced('1 second') };\nEffect.retry(call, options);",
      errors: [unbounded],
    },
    {
      code: effect + "const backoff = Schedule.spaced('1 second');\nEffect.retry(call, backoff);",
      errors: [unbounded],
    },
    {
      code: effect + "Effect.retryOrElse(call, Schedule.forever, recover);",
      errors: [unbounded],
    },
    {
      code: effect + "pipe(call, Effect.retry(Schedule.forever), Effect.map(format));",
      errors: [unbounded],
    },
    {
      code: 'import * as Effect from "effect/Effect";\nimport * as Schedule from "effect/Schedule";\ncall.pipe(Effect.retry(Schedule.forever));',
      errors: [unbounded],
    },
  ],
});
