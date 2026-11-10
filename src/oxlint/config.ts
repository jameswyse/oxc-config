import { defineLintPreset } from "./preset.ts";
import { comments } from "./profiles/comments.ts";
import { core } from "./profiles/core.ts";
import { effect } from "./profiles/effect.ts";
import { electron } from "./profiles/electron.ts";
import { errors } from "./profiles/errors.ts";
import { modules } from "./profiles/modules.ts";
import { mutation } from "./profiles/mutation.ts";
import { nextjs } from "./profiles/nextjs.ts";
import { node } from "./profiles/node.ts";
import { boundaries, clock, env, random, serverActionGuards } from "./profiles/ownership.ts";
import { react } from "./profiles/react.ts";
import { security } from "./profiles/security.ts";
import { spacing } from "./profiles/spacing.ts";
import { jest, tests, vitest } from "./profiles/tests.ts";
import { types } from "./profiles/types.ts";

export const createLintConfig = defineLintPreset({
  base: [core, types, security, errors, modules, comments, mutation, tests, spacing],
  profiles: {
    env,
    clock,
    random,
    boundaries,
    electron,
    serverActionGuards,
    node,
    react,
    nextjs,
    vitest,
    jest,
    effect,
  },
});

export { defaultIgnores } from "../ignores.ts";

export type { FileScope, ImportBoundary, SharedLintConfig } from "./preset.ts";

export type LintOptions = NonNullable<Parameters<typeof createLintConfig>[0]>;
