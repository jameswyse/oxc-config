// Adapted from dmmulroy/anti-slop
import { ruleTester } from "../../../shared/rule-tester.ts";
import { noModuleMocking } from "./no-module-mocking.ts";

const error = { messageId: "moduleMock" };
ruleTester.run("no-module-mocking", noModuleMocking, {
  valid: [
    'import { mock } from "node:test"; mock.fn(save);',
    'registry.mock.module("./database");',
    'import { test } from "node:test"; test("loads", () => { registry.mock.module("./database"); });',
    "const registry = { module: load }; registry.module('x');",
    "const store = new InMemoryUserStore();",
    "vi.spyOn(store, 'save');",
    "const vi = { mock() {} }; vi.mock();",
    "function test(jest: { mock(): void }) { jest.mock(); }",
    "import { vi as localVi } from './helpers'; localVi.mock('./module');",
  ],
  invalid: [
    {
      code: 'import { vi } from "@effect/vitest"; vi.mock("./database");',
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: 'import { mock } from "node:test"; mock.module("./database", { namedExports: {} });',
      errors: [{ messageId: "moduleMock" }],
    },
    {
      code: 'import { test } from "node:test"; test("saves", (t) => { t.mock.module("./database", {}); });',
      errors: [{ messageId: "moduleMock" }],
    },
    { code: "vi.mock('./user-store');", errors: [error] },
    { code: "jest.mock('./user-store');", errors: [error] },
    { code: "vi['doMock']('./user-store');", errors: [error] },
    { code: "jest.unstable_mockModule('./user-store');", errors: [error] },
    { code: "import { vi } from 'vitest'; vi.mock('./user-store');", errors: [error] },
    {
      code: "import { vi as testApi } from 'vitest'; testApi.mock('./user-store');",
      errors: [error],
    },
    { code: "import { jest } from '@jest/globals'; jest.mock('./user-store');", errors: [error] },
  ],
});
