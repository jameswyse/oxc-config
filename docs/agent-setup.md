# Set up @jameswyse/oxc-config with a coding agent

These instructions are for a coding agent setting up @jameswyse/oxc-config in a repository. [The configuration guide](configuration.md) documents each file and option named here. Follow it for the exact syntax.

## Install and create the configs

Install the package and its peers, then create `oxlint.config.ts` and `oxfmt.config.ts`. In a monorepo, check which directory each package's lint script runs from and which config Oxlint finds from there.

Extend `@jameswyse/oxc-config/tsconfig` unless the project's existing compiler settings conflict with it.

## Choose options from evidence

Survey the code before choosing options. Pass each option the evidence supports:

- `react`, `nextjs`, `node`, `vitest`, `jest`, `effect`, `electron` and `tests`: the frameworks, runtimes and test runners each package uses, scoped to the files that use them.
- `env`: the modules that read `process.env` or `import.meta.env`. Each runtime should have one module that parses configuration and passes typed values on. If reads are scattered, list them as owners for now and record the consolidation as follow-up.
- `boundaries`: code that must not import from another part of the project, such as browser code importing server modules, Node built-ins or database clients, an Electron renderer importing main-process code, or a shared package importing an application.
- `serverActionGuards`: the functions that `"use server"` actions call to check authentication or permissions.
- `clock` and `random`: the modules that own the current time and ID or random value generation.

## Fix the violations

Run the lint and format scripts and fix the violations. Suppress a rule only where it reports correct code, with the reason after `--`, and list each such case as a possible upstream issue.

## Report

Report every option above, with the value you set or the evidence for leaving it out. Leaving out `env` or `boundaries` in an application needs a specific reason.
