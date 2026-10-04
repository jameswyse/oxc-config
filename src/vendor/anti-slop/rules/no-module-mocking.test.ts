// Adapted from dmmulroy/anti-slop
import { ruleTester } from "../../../shared/rule-tester.ts";
import { noModuleMocking } from "./no-module-mocking.ts";

const error = { messageId: "moduleMock" };
ruleTester.run("no-module-mocking", noModuleMocking, {
  valid: [
    "const store = new InMemoryUserStore();",
    "vi.spyOn(store, 'save');",
    "const vi = { mock() {} }; vi.mock();",
    "function test(jest: { mock(): void }) { jest.mock(); }",
    "import { vi as localVi } from './helpers'; localVi.mock('./module');",
  ],
  invalid: [
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
