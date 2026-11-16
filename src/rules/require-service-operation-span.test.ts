import { ruleTester } from "../shared/rule-tester.ts";
import { requireServiceOperationSpan } from "./require-service-operation-span.ts";

const effect = 'import { Effect, Layer, Stream } from "effect";\n';
const untraced = (name: string) => ({ messageId: "untraced", data: { name } });

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
      errors: [untraced("get")],
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
  ],
});
