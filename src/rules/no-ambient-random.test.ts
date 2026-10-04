import { ruleTester } from "../shared/rule-tester.ts";
import { noAmbientRandom } from "./no-ambient-random.ts";

ruleTester.run("no-ambient-random", noAmbientRandom, {
  valid: [
    "const value = Math.floor(input);",
    "const Math = seeded; const value = Math.random();",
    "function pick(Math: { random(): number }) { return Math.random(); }",
    'import { randomUUID } from "./ids"; const id = randomUUID();',
    'import { randomBytes } from "node:crypto"; const token = randomBytes(32);',
    "const bytes = crypto.getRandomValues(new Uint8Array(16));",
    'import crypto from "node:crypto"; const hash = crypto.createHash("sha256");',
    "function createRequestId(createId: () => string = () => crypto.randomUUID()) { return createId(); }",
    "const dependencies = { random: Math.random, createId: () => crypto.randomUUID() };",
    'import { randomUUID } from "node:crypto"; const dependencies = { createId: randomUUID };',
    "const supported = typeof crypto.randomUUID === 'function';",
    "function create(crypto: Crypto) { return crypto.randomUUID(); }",
  ],
  invalid: [
    { code: "const value = Math.random();", errors: [{ messageId: "random" }] },
    { code: "const id = crypto.randomUUID();", errors: [{ messageId: "random" }] },
    { code: "const id = globalThis.crypto.randomUUID();", errors: [{ messageId: "random" }] },
    {
      code: 'import { randomUUID } from "node:crypto"; const first = randomUUID(); const second = randomUUID();',
      errors: [{ messageId: "random" }, { messageId: "random" }],
    },
    {
      code: 'import { randomInt as pick } from "crypto"; const index = pick(3);',
      errors: [{ messageId: "random" }],
    },
    {
      code: 'import * as crypto from "node:crypto"; const index = crypto.randomInt(10);',
      errors: [{ messageId: "random" }],
    },
    {
      code: 'import crypto from "node:crypto"; const id = crypto.randomUUID();',
      errors: [{ messageId: "random" }],
    },
    {
      code: 'import { webcrypto } from "node:crypto"; const id = webcrypto.randomUUID();',
      errors: [{ messageId: "random" }],
    },
    {
      code: "const delay = base * (0.75 + Math.random() * 0.5);",
      errors: [{ messageId: "random" }],
    },
    {
      code: "const id = options.id ?? `quote-${crypto.randomUUID()}`;",
      errors: [{ messageId: "random" }],
    },
  ],
});
