# @jameswyse/oxc-config

Opinionated [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) and [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) configs for TypeScript and JavaScript projects. They combine Oxlint's native rules with custom rules for type and data safety, comment-free code, configuration ownership, import boundaries, server-action guards, test reliability and statement spacing.

The rules aim to keep both people and coding agents on the same standards: parse external data at the seam, use named exports, never ship console logging, and let names, types and tests carry intent instead of comments. [The reference](REFERENCE.md) maps each standard to its rules.

## Example: a test that can't fail

Coding agents often write tests that pass whatever the code does. This one passes as long as `parseUser` is exported:

```ts
test("parseUser", () => {
  expect(parseUser).toBeDefined();
});
```

```text
error wyse(no-edit-proof-assertions): This assertion only proves that an import exists or that a value is a function. Call it and assert the behaviour it provides.
```

Calling the function and checking its result passes:

```ts
test("parseUser reads the name from JSON", () => {
  expect(parseUser('{"name":"Ada"}')).toEqual({ name: "Ada" });
});
```

This is one rule of many. [The reference](REFERENCE.md) lists the rest, from unparsed external data and scattered `process.env` reads to server actions that skip their auth check.

## Set up with a coding agent

Give the agent this prompt:

```text
Set up @jameswyse/oxc-config in this repository by following
https://github.com/jameswyse/oxc-config/blob/main/docs/agent-setup.md
```

## Set up by hand

Install the package and its peers. It requires Node.js 22.23 or later.

```sh
pnpm add -D @jameswyse/oxc-config oxlint oxfmt oxlint-tsgolint
```

Create `oxlint.config.ts` and `oxfmt.config.ts` in the project root:

```ts
import { createLintConfig } from "@jameswyse/oxc-config/oxlint";

export default createLintConfig();
```

```ts
import { formatConfig } from "@jameswyse/oxc-config/oxfmt";

export default formatConfig;
```

Type-aware checking is on by default and needs a `tsconfig.json` that TypeScript 7 accepts. The defaults enable no framework profiles or project boundaries. The [configuration guide](docs/configuration.md) covers supported versions, scripts, framework profiles, project boundaries, the shared tsconfig, exceptions and formatter options.

## Documentation

- [Configuration guide](docs/configuration.md)
- [Agent setup instructions](docs/agent-setup.md)
- [Rule reference](REFERENCE.md)
- [Contributing](CONTRIBUTING.md)

## Vendored code

Some code is adapted from other MIT-licensed projects. Each project's licence sits beside its code in `src/vendor`.

- [anti-slop](https://github.com/dmmulroy/anti-slop): 17 rules and their shared helpers, in `src/vendor/anti-slop`.
- [ESLint Stylistic](https://github.com/eslint-stylistic/eslint-stylistic): the `padding-line-between-statements` engine behind `statement-spacing`, in `src/vendor/eslint-stylistic`.

## Licence

[MIT](LICENSE).
