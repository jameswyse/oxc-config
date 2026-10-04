import { ruleTester } from "../shared/rule-tester.ts";
import { noEditProofAssertions } from "./no-edit-proof-assertions.ts";

ruleTester.run("no-edit-proof-assertions", noEditProofAssertions, {
  valid: [
    'import { expect } from "vitest"; import { parse } from "./parse"; expect(parse("1")).toBe(1);',
    'import { expect } from "vitest"; import { parse } from "./parse"; expect(parse("1")).toBeDefined();',
    'import { expect } from "vitest"; import { config } from "./config"; expect(config.apiUrl).toBeDefined();',
    'import { expect } from "vitest"; import { parse } from "./parse"; expect(parse).not.toBeDefined();',
    'import { expect } from "vitest"; import { parse } from "./parse"; expect(parse).toBeUndefined();',
    'import { expect } from "vitest"; import * as api from "./api"; expect(api).not.toHaveProperty("legacy");',
    'import { expect } from "vitest"; import { parse } from "./parse"; expect(parse).toHaveProperty("name");',
    'import { expect } from "vitest"; const result = run(); expect(result).toBeDefined();',
    'import { expect } from "vitest"; const result = run(); expect(typeof result.count).toBe("number");',
    'import { expect } from "vitest"; const result = run(); expect(result.count).toBeTypeOf("number");',
    'import { expect } from "vitest"; const handler = run(); expect(typeof handler).not.toBe("function");',
    'import { expect } from "./assertions"; import { parse } from "./parse"; expect(parse).toBeDefined();',
    'import { expect } from "vitest"; import { parse } from "./parse"; function check(parse) { expect(parse).toBeDefined(); }',
    'import { expect } from "vitest"; const mod = import("./parse"); expect(mod).toBeDefined();',
  ],
  invalid: [
    {
      code: 'import { expect } from "vitest"; import { parse } from "./parse"; expect(parse).toBeDefined();',
      errors: [{ messageId: "editProof" }],
    },
    {
      code: 'import { expect } from "vitest"; import parse from "./parse"; expect(parse).not.toBeUndefined();',
      errors: [{ messageId: "editProof" }],
    },
    {
      code: 'import { expect } from "@jest/globals"; import * as api from "./api"; expect(api.parse).toBeTruthy();',
      errors: [{ messageId: "editProof" }],
    },
    {
      code: 'import * as api from "./api"; expect(api.parse).toBeDefined();',
      errors: [{ messageId: "editProof" }],
    },
    {
      code: 'import { expect } from "vitest"; import { parse } from "./parse"; expect(typeof parse).toBe("function");',
      errors: [{ messageId: "editProof" }],
    },
    {
      code: 'import { expect } from "vitest"; import { VERSION } from "./version"; expect(typeof VERSION).toEqual("string");',
      errors: [{ messageId: "editProof" }],
    },
    {
      code: 'import { expect } from "vitest"; import * as api from "./api"; expect(api).toHaveProperty("parse");',
      errors: [{ messageId: "editProof" }],
    },
    {
      code: 'import { expect } from "vitest"; import * as api from "./api"; expect(api.VERSION).toBeTypeOf("string");',
      errors: [{ messageId: "editProof" }],
    },
    {
      code: 'import { expect, it } from "vitest"; it("loads", async () => { const api = await import("./api"); expect(api.parse).toBeDefined(); });',
      errors: [{ messageId: "editProof" }],
    },
    {
      code: 'import { expect, it } from "vitest"; it("loads", async () => { const { parse } = await import("./parse"); expect(parse).toBeDefined(); });',
      errors: [{ messageId: "editProof" }],
    },
    {
      code: 'import { expect } from "vitest"; const log = createLogger(); expect(log.error).toBeTypeOf("function");',
      errors: [{ messageId: "editProof" }],
    },
    {
      code: 'import { expect } from "vitest"; expect(typeof result.current.actions.save).toBe("function");',
      errors: [{ messageId: "editProof" }],
    },
    {
      code: 'import { expect as check } from "@playwright/test"; import { parse } from "./parse"; check.soft(parse).toBeDefined();',
      errors: [{ messageId: "editProof" }],
    },
  ],
});
