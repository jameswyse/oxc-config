import { basename } from "node:path";

import { defineRule } from "@oxlint/plugins";

import { projectPath, testModules } from "../shared/index.ts";

import type { ESTree } from "@oxlint/plugins";

const sourceFileName = /^(?<stem>.+)\.(?<extension>js|jsx|mjs|cjs|ts|tsx|mts|cts)$/;

const testSegments = new Set(["spec", "specs", "tests"]);

const testHelperSegments = new Set([
  "test-helper",
  "test-helpers",
  "test-util",
  "testutil",
  "testutils",
  "test-utilities",
]);

const bareTestHelperNames = new Set(["test-helper", "test-helpers", "test-utils", "testutils"]);

const testSupportSegments = new Set([
  "mock",
  "mocks",
  "stub",
  "stubs",
  "harness",
  "helper",
  "helpers",
]);

const bareTestSupportNames = new Set(["mock", "mocks", "stubs", "harness"]);

const suffixedMockOrStubName = /^(?<subject>.+?)[-_](?:mocks?|stubs?)$/;

const bareFixtureNames = new Set(["fixture", "fixtures"]);

const suffixedFixtureName = /^(?<subject>.+?)[-_]fixtures?$/;

const testDirectories = new Set([
  "test",
  "tests",
  "__tests__",
  "e2e",
  "fixtures",
  "__fixtures__",
  "mocks",
  "__mocks__",
]);

const manualMockDirectory = "__mocks__";

type FileName = {
  name: string;
  subject: string[];
  last: string;
  stem: string;
  extension: string;
};

type Finding = {
  messageId: "test" | "fixture" | "helper";
  subject: string;
  kind: string;
};

function parseFileName(filename: string) {
  const name = basename(filename);
  const groups = sourceFileName.exec(name)?.groups;

  if (groups?.stem === undefined || groups.extension === undefined) {
    return null;
  }

  const segments = groups.stem.split(".");
  const last = segments.pop();

  if (last === undefined) {
    return null;
  }

  return { name, subject: segments, last, stem: groups.stem, extension: groups.extension };
}

function isTestLibrary(module: string) {
  return (
    testModules.has(module) ||
    module.startsWith("@testing-library/") ||
    module === "msw" ||
    module.startsWith("msw/")
  );
}

function importsTestLibrary(program: ESTree.Program) {
  return program.body.some(
    (statement) => statement.type === "ImportDeclaration" && isTestLibrary(statement.source.value),
  );
}

function helperSubject(subject: readonly string[]) {
  return (subject.at(-1) === "test" ? subject.slice(0, -1) : subject).join(".");
}

function fixture(subject: string) {
  return { messageId: "fixture", subject, kind: "fixture" } satisfies Finding;
}

function helper(subject: string) {
  return { messageId: "helper", subject, kind: "test-utils" } satisfies Finding;
}

function unambiguousFinding({ subject, last, stem }: FileName) {
  if (subject.length > 0 && testSegments.has(last)) {
    return { messageId: "test", subject: subject.join("."), kind: "test" } satisfies Finding;
  }

  if (bareFixtureNames.has(stem)) {
    return fixture("");
  }

  if (subject.length > 0 && last === "fixtures") {
    return fixture(subject.join("."));
  }

  if (bareTestHelperNames.has(stem)) {
    return helper("");
  }

  if (subject.length > 0 && testHelperSegments.has(last)) {
    return helper(helperSubject(subject));
  }

  return null;
}

function testSupportFinding({ subject, last, stem }: FileName) {
  const fixtureSubject = suffixedFixtureName.exec(stem)?.groups?.subject;

  if (fixtureSubject !== undefined) {
    return fixture(fixtureSubject);
  }

  if (bareTestSupportNames.has(stem)) {
    return helper("");
  }

  if (subject.length > 0 && testSupportSegments.has(last)) {
    return helper(helperSubject(subject));
  }

  const mockSubject = suffixedMockOrStubName.exec(stem)?.groups?.subject;

  return mockSubject === undefined ? null : helper(mockSubject);
}

export const testFileSuffixes = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Name tests `<subject>.test.<ext>`, fixtures `<subject>.fixture.<ext>` and test helpers `<subject>.test-utils.<ext>`.",
    },
    schema: [],
    messages: {
      test: "Rename '{{name}}' to '{{suggestion}}'. Name every test `<subject>.test.<ext>`, with any runtime infix such as `.e2e` before `.test`.",
      fixture:
        "Rename '{{name}}' to '{{suggestion}}'. Name every fixture file `<subject>.fixture.<ext>`.",
      helper:
        "Rename '{{name}}' to '{{suggestion}}'. Name every test helper, mock and stub file `<subject>.test-utils.<ext>`.",
    },
  },
  create(context) {
    const file = parseFileName(context.filename);
    const directories = projectPath(context.cwd, context.filename).split("/").slice(0, -1);

    if (file === null) {
      return {};
    }

    const inManualMockDirectory = directories.includes(manualMockDirectory);
    const inTestDirectory = directories.some((directory) => testDirectories.has(directory));

    return {
      Program(node) {
        const finding =
          unambiguousFinding(file) ??
          (inTestDirectory || importsTestLibrary(node) ? testSupportFinding(file) : null);

        if (finding === null || (inManualMockDirectory && finding.messageId !== "test")) {
          return;
        }

        context.report({
          node,
          messageId: finding.messageId,
          data: {
            name: file.name,
            suggestion: `${finding.subject || "<subject>"}.${finding.kind}.${file.extension}`,
          },
        });
      },
    };
  },
});
