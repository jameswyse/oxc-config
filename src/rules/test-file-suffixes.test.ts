import { ruleTester } from "../shared/rule-tester.ts";
import { testFileSuffixes } from "./test-file-suffixes.ts";

const code = "export const value = 1;";

const vitestCode = 'import { vi } from "vitest";\nexport const clock = vi.fn();';

function codeFor(name: string) {
  return name.endsWith(".cjs") ? "module.exports = { value: 1 };" : code;
}

function file(name: string) {
  return `/project/src/quote/${name}`;
}

function testFile(name: string) {
  return `/project/test/quote/${name}`;
}

function inProject<Case extends object>(cases: Case[]) {
  return cases.map((testCase) => ({ cwd: "/project", ...testCase }));
}

ruleTester.run("test-file-suffixes", testFileSuffixes, {
  valid: inProject([
    ...[
      "quote.test.ts",
      "Quote.test.tsx",
      "quote.browser.test.tsx",
      "checkout.e2e.test.ts",
      "quote.fixture.ts",
      "quote.fixture.json",
      "quote.test-utils.ts",
      "quote.helpers.ts",
      "date.helpers.ts",
      "quote.helper.mjs",
      "quote.ts",
      "spec.ts",
      "tests.ts",
      "mock.ts",
      "mocks.ts",
      "stubs.ts",
      "harness.ts",
      "quote.mock.ts",
      "api.mocks.tsx",
      "quote.stub.mjs",
      "quote.stubs.js",
      "checkout.harness.ts",
      "quote-mock.ts",
      "quote_mocks.ts",
      "quote-stub.ts",
      "quote_stubs.ts",
      "quote-fixture.ts",
      "quote_fixtures.ts",
      "team-fixtures.tsx",
      "quote.spec.json",
      "quote.mocks.json",
      "quote.mocks.d.ts",
      "quoteFixture.ts",
      "fixturesLoader.ts",
      "quote.specification.ts",
      "quote.mocking.ts",
      "mockup.ts",
    ].map((name) => ({ code, filename: file(name) })),
    { code, filename: "/project/scripts/record-replay-fixture.ts" },
    { code, cwd: "/home/test/project", filename: "/home/test/project/src/api-mock.ts" },
    { code, filename: "/project/src/fixtures/quote.ts" },
    { code, filename: "/project/test/fixtures/large-quote.json.ts" },
    { code, filename: testFile("quote.fixture.ts") },
    { code, filename: testFile("quote.test-utils.ts") },
    { code, filename: testFile("stub.ts") },
    ...[
      "/project/src/__mocks__/axios.ts",
      "/project/src/__mocks__/mocks.ts",
      "/project/src/__mocks__/api-mock.ts",
      "/project/src/__mocks__/quote.mock.ts",
      "/project/src/__mocks__/fixtures.ts",
      "/project/src/__mocks__/test-utils.ts",
    ].map((filename) => ({ code: vitestCode, filename })),
    {
      code: 'import { format } from "date-fns";\nexport const label = format;',
      filename: file("date.helpers.ts"),
    },
    {
      code: vitestCode,
      filename: file("quote.test-utils.ts"),
    },
  ]),
  invalid: inProject([
    ...[
      ["quote.spec.ts", "quote.test.ts"],
      ["Quote.spec.tsx", "Quote.test.tsx"],
      ["quote.specs.js", "quote.test.js"],
      ["quote.tests.mts", "quote.test.mts"],
      ["checkout.e2e.spec.ts", "checkout.e2e.test.ts"],
    ].map(([name = "", suggestion]) => ({
      code: codeFor(name),
      filename: file(name),
      errors: [{ messageId: "test", data: { name, suggestion } }],
    })),
    ...[
      ["fixture.ts", "<subject>.fixture.ts"],
      ["fixtures.js", "<subject>.fixture.js"],
      ["quote.fixtures.cts", "quote.fixture.cts"],
    ].map(([name = "", suggestion]) => ({
      code: codeFor(name),
      filename: file(name),
      errors: [{ messageId: "fixture", data: { name, suggestion } }],
    })),
    ...[
      ["quote-fixture.ts", "quote.fixture.ts"],
      ["quote-fixtures.cjs", "quote.fixture.cjs"],
      ["quote_fixture.tsx", "quote.fixture.tsx"],
      ["quote_fixtures.jsx", "quote.fixture.jsx"],
    ].map(([name = "", suggestion]) => ({
      code: codeFor(name),
      filename: testFile(name),
      errors: [{ messageId: "fixture", data: { name, suggestion } }],
    })),
    {
      code: vitestCode,
      filename: file("team-fixtures.ts"),
      errors: [
        {
          messageId: "fixture",
          data: { name: "team-fixtures.ts", suggestion: "team.fixture.ts" },
        },
      ],
    },
    {
      code,
      filename: "/project/src/fixtures/fixtures.ts",
      errors: [{ messageId: "fixture" }],
    },
    ...[
      ["quote.test-helper.ts", "quote.test-utils.ts"],
      ["quote.test-helpers.ts", "quote.test-utils.ts"],
      ["quote.test-util.ts", "quote.test-utils.ts"],
      ["quote.testutil.ts", "quote.test-utils.ts"],
      ["quote.testutils.ts", "quote.test-utils.ts"],
      ["quote.test-utilities.ts", "quote.test-utils.ts"],
      ["test-helpers.ts", "<subject>.test-utils.ts"],
      ["test-helper.tsx", "<subject>.test-utils.tsx"],
      ["test-utils.ts", "<subject>.test-utils.ts"],
      ["testutils.js", "<subject>.test-utils.js"],
    ].map(([name = "", suggestion]) => ({
      code: codeFor(name),
      filename: file(name),
      errors: [{ messageId: "helper", data: { name, suggestion } }],
    })),
    ...[
      ["quote.mock.ts", "quote.test-utils.ts"],
      ["api.mocks.tsx", "api.test-utils.tsx"],
      ["quote.stub.mjs", "quote.test-utils.mjs"],
      ["quote.stubs.js", "quote.test-utils.js"],
      ["checkout.harness.ts", "checkout.test-utils.ts"],
      ["quote.helpers.ts", "quote.test-utils.ts"],
      ["quote.test.mocks.ts", "quote.test-utils.ts"],
      ["mock.ts", "<subject>.test-utils.ts"],
      ["mocks.ts", "<subject>.test-utils.ts"],
      ["stubs.ts", "<subject>.test-utils.ts"],
      ["harness.ts", "<subject>.test-utils.ts"],
      ["api-mock.ts", "api.test-utils.ts"],
      ["api-mocks.ts", "api.test-utils.ts"],
      ["api_mock.ts", "api.test-utils.ts"],
      ["api_mocks.ts", "api.test-utils.ts"],
      ["api-stub.ts", "api.test-utils.ts"],
      ["api-stubs.ts", "api.test-utils.ts"],
      ["api_stub.ts", "api.test-utils.ts"],
      ["api_stubs.ts", "api.test-utils.ts"],
    ].map(([name = "", suggestion]) => ({
      code: codeFor(name),
      filename: testFile(name),
      errors: [{ messageId: "helper", data: { name, suggestion } }],
    })),
    ...[
      "/project/tests/api-mock.ts",
      "/project/src/__tests__/api-mock.ts",
      "/project/e2e/api-mock.ts",
      "/project/src/fixtures/api-mock.ts",
      "/project/src/__fixtures__/api-mock.ts",
      "/project/src/mocks/api-mock.ts",
    ].map((filename) => ({
      code,
      filename,
      errors: [
        {
          messageId: "helper",
          data: { name: "api-mock.ts", suggestion: "api.test-utils.ts" },
        },
      ],
    })),
    ...[
      'import { vi } from "vitest";',
      'import { it } from "@effect/vitest";',
      'import { jest } from "@jest/globals";',
      'import { mock } from "node:test";',
      'import { expect } from "@playwright/test";',
      'import { render } from "@testing-library/react";',
      'import userEvent from "@testing-library/user-event";',
      'import { http } from "msw";',
      'import { setupServer } from "msw/node";',
      'import type { Mock } from "vitest";',
    ].map((imports) => ({
      code: `${imports}\nexport const value = 1;`,
      filename: file("quote.helpers.ts"),
      errors: [
        {
          messageId: "helper",
          data: { name: "quote.helpers.ts", suggestion: "quote.test-utils.ts" },
        },
      ],
    })),
    ...[
      ["quote.test.helper.tsx", "quote.test-utils.tsx"],
      ["quote.mock.ts", "quote.test-utils.ts"],
      ["mocks.ts", "<subject>.test-utils.ts"],
      ["api-mock.ts", "api.test-utils.ts"],
    ].map(([name = "", suggestion]) => ({
      code: vitestCode,
      filename: file(name),
      errors: [{ messageId: "helper", data: { name, suggestion } }],
    })),
    {
      code,
      filename: "/project/tests/user-stub.ts",
      errors: [
        { messageId: "helper", data: { name: "user-stub.ts", suggestion: "user.test-utils.ts" } },
      ],
    },
    ...[
      ["/project/src/__mocks__/checkout.spec.ts", "checkout.spec.ts", "checkout.test.ts"],
      ["/project/src/__mocks__/fs/promises.spec.ts", "promises.spec.ts", "promises.test.ts"],
    ].map(([filename = "", name, suggestion]) => ({
      code: vitestCode,
      filename,
      errors: [{ messageId: "test", data: { name, suggestion } }],
    })),
  ]),
});
