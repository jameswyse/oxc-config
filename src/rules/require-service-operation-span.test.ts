import { ruleTester } from "../shared/rule-tester.ts";
import { requireServiceOperationSpan } from "./require-service-operation-span.ts";

const effect = 'import { Context, Effect, Layer, Stream } from "effect";\n';

const untraced = (name: string, service = "Service") => ({
  messageId: "untraced",
  data: { name, service },
});

const untracedStream = (name: string, service = "Service") => ({
  messageId: "untracedStream",
  data: { name, service },
});

ruleTester.run("require-service-operation-span", requireServiceOperationSpan, {
  valid: [
    effect +
      `export const layer = Layer.effect(Service, Effect.gen(function* () {
  return Service.of({
    get: () => Effect.gen(function* () { return yield* find().pipe(Effect.withSpan("Users.get")); }),
  });
}));`,
    effect +
      `export const layer = Layer.effect(Service, Effect.gen(function* () {
  const get = Effect.fn("Users.get")(function* (id) { return yield* find(id); });
  return Service.of({ get });
}));`,
    effect +
      `export const layer = Layer.effect(Service, Effect.gen(function* () {
  return Service.of({
    get: (id) => find(id).pipe(Effect.withSpan("Users.get")),
    watch: (id) => changes(id).pipe(Stream.withSpan("Users.watch")),
    count: Effect.fnUntraced(function* () { return 1; }),
  });
}));`,
    effect +
      `const lookup = Effect.fn("Users.lookup")(function* (id) { return yield* find(id); });
export const layer = Layer.effect(Service, Effect.gen(function* () {
  return Service.of({ get: (id) => lookup(id) });
}));`,
    effect +
      `export const layer = Layer.effect(Service, Effect.gen(function* () {
  return Service.of({ all: findAll, limit: 10 });
}));`,
    effect + "export const layer = Layer.succeed(Service, implementation);",
    effect +
      "export const layer = Layer.succeed(Service, { load: async (id) => fetch(id), get: Effect.fnUntraced(function* () {}) });",
    effect +
      "export function layer(urls: () => string[]) {\n  return Layer.succeed(Service, Service.of({ urls }));\n}",
    'import { Effect, Layer } from "./effect";\nLayer.succeed(Service, { get: (id) => find(id) });',
  ],
  invalid: [
    {
      code:
        effect +
        `export const layer = Layer.effect(Service, Effect.gen(function* () {
  const get = Effect.fn(function* (id) { return yield* find(id); });
  return Service.of({ get, list: Effect.fn(function* () { return yield* findAll(); }) });
}));`,
      errors: [untraced("get"), untraced("list")],
    },
    {
      code:
        effect +
        `export const layer = Layer.effect(Service, Effect.gen(function* () {
  return Service.of({
    get: (id) => {
      const traced = () => find(id).pipe(Effect.withSpan("unused"));
      return find(id);
    },
  });
}));`,
      errors: [untraced("get")],
    },
    {
      code:
        effect +
        `export const layer = Layer.effect(Service, Effect.gen(function* () {
  if (disabled) {
    return Service.of({ get: (id) => Effect.succeed(id) });
  }
  return Service.of({ get: Effect.fn("Users.get")(function* (id) { return yield* find(id); }) });
}).pipe(Effect.orDie));`,
      errors: [untraced("get")],
    },
    {
      code:
        effect +
        `export const layer = Layer.effect(Service, Effect.gen(function* () {
  const get = (id) => find(id);
  return Service.of({ get });
}));`,
      errors: [untraced("get")],
    },
    {
      code:
        effect +
        `const make = Effect.gen(function* () {
  return { get: (id) => find(id), list: function () { return findAll(); } };
});
export const layer = Layer.effect(Service, make);`,
      errors: [untraced("get"), untraced("list")],
    },
    {
      code:
        effect +
        `class Users {
  static readonly layer = Layer.effect(this)(Effect.gen(function* () {
    return Users.of({ get: (id) => Effect.fn(function* () { return yield* find(id); })() });
  }));
}`,
      errors: [untraced("get", "Users")],
    },
    {
      code:
        effect +
        "export const layer = Layer.succeed(Service, Service.of({ get: (id) => find(id) }));",
      errors: [untraced("get")],
    },
    {
      code:
        effect +
        `function get(id) {
  return find(id);
}
export const layer = Layer.succeed(Service, { get });`,
      errors: [untraced("get")],
    },
    {
      code: effect + "export const layer = Layer.sync(Service, () => ({ get: (id) => find(id) }));",
      errors: [untraced("get")],
    },
    {
      code:
        effect +
        `export class ActivityFeed extends Context.Service<
  ActivityFeed,
  {
    readonly record: (event: Event) => Effect.Effect<void>;
    readonly watchActivity: (query: Query) => Stream.Stream<ActivityPage>;
    readonly watchBatch: (batchId: BatchId) => Stream.Stream<BatchDetail, BatchNotFound>;
    watchRun(runId: RunId): Stream.Stream<Run>;
  }
>()("fleetfrog/ActivityFeed") {
  static readonly layer = Layer.effect(this)(
    Effect.gen(function* () {
      const store = yield* ActivityStore;
      const onChange = <A, E>(read: Effect.Effect<A, E>) =>
        Stream.merge(Stream.succeed(undefined), Stream.fromPubSub(invalidations)).pipe(
          Stream.mapEffect(() => read),
        );
      return {
        record: (event) => store.record(event),
        watchActivity: (query) => onChange(store.activity(query)),
        watchBatch: (batchId) => store.batch(batchId),
        watchRun: (runId) => store.run(runId),
      };
    }),
  );
}`,
      errors: [
        untraced("record", "ActivityFeed"),
        untracedStream("watchActivity", "ActivityFeed"),
        untracedStream("watchBatch", "ActivityFeed"),
        untracedStream("watchRun", "ActivityFeed"),
      ],
    },
    {
      code:
        effect +
        `class Users extends Context.Service<Users, { readonly get: (id: string) => Effect.Effect<User> }>()("Users") {}
export const layer = Layer.effect(Users, Effect.gen(function* () {
  return Users.of({
    get: (id) => find(id),
    watch: (id) => changes(id).pipe(Stream.map(toUser)),
    poll: (id) => Stream.fromEffect(find(id)),
    stream: function () { return Stream.empty; },
    collect: (id) => changes(id).pipe(Stream.runCollect),
    drain: (id) => Stream.run(changes(id), sink),
  });
}));`,
      errors: [
        untraced("get", "Users"),
        untracedStream("watch", "Users"),
        untracedStream("poll", "Users"),
        untracedStream("stream", "Users"),
        untraced("collect", "Users"),
        untraced("drain", "Users"),
      ],
    },
    {
      code:
        'import { Effect, Layer } from "effect";\nimport * as Stream from "effect/Stream";\n' +
        "export const layer = Layer.succeed(Users, { watch: (id) => (live ? Stream.never : changes(id)) });",
      errors: [untracedStream("watch", "Users")],
    },
  ],
});
