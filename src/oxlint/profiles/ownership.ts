import type { ImportBoundary, LintLayer, LintScope, OneOrMore, Profile } from "../preset.ts";

interface OwnedRule {
  rule: string;
  scope: LintScope;
  owners: OneOrMore<string>;
  excludeFiles: string[];
}

function ownedRule({ rule, scope, owners, excludeFiles }: OwnedRule): LintLayer[] {
  return [
    { files: scope.source, excludeFiles, rules: { [rule]: "error" } },
    { files: [...scope.entrypoints, ...owners], rules: { [rule]: "off" } },
  ];
}

export const env: Profile<OneOrMore<string>> = (scope, owners) =>
  ownedRule({ rule: "wyse/no-env-access", scope, owners, excludeFiles: [] });

export const clock: Profile<OneOrMore<string>> = (scope, owners) =>
  ownedRule({ rule: "wyse/no-ambient-clock", scope, owners, excludeFiles: scope.tests });

export const random: Profile<OneOrMore<string>> = (scope, owners) =>
  ownedRule({ rule: "wyse/no-ambient-random", scope, owners, excludeFiles: scope.tests });

export const boundaries: Profile<ImportBoundary[]> = (_scope, imports) => [{ boundaries: imports }];

export const serverActionGuards: Profile<OneOrMore<string>> = (scope, guards) => [
  {
    files: scope.source,
    excludeFiles: scope.tests,
    rules: { "wyse/server-action-guard": ["error", { guards }] },
  },
];
