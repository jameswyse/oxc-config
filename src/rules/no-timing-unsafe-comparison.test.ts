import { ruleTester } from "../shared/rule-tester.ts";
import { noTimingUnsafeComparison } from "./no-timing-unsafe-comparison.ts";

const error = { messageId: "comparison" };

ruleTester.run("no-timing-unsafe-comparison", noTimingUnsafeComparison, {
  valid: [
    "if (token === null) {}",
    "if (token !== undefined) {}",
    "if (user.passwordHash == null) {}",
    "if (session.secret === false) {}",
    "if (typeof apiKey === 'string') {}",
    "if (typeof apiKey !== typeof other) {}",
    "if (signature === '') {}",
    "if (passwordHash === 0) {}",
    "if (token === -1) {}",
    "if (signature === ``) {}",
    "if (type === AuthType.Password) {}",
    "if (method === AuthMethod.Token) {}",
    "if (type === AuthType.AccessAPIToken) {}",
    "if (keyHash.length === size) {}",
    "if (monkey === key) {}",
    "if (token.length === 0) {}",
    "if (digest !== void 0) {}",
    "if (tokenCount === limit) {}",
    "if (tokenType === 'Bearer') {}",
    "if (isTokenValid === expected) {}",
    "if (hashtag === tag) {}",
    "if (tokenizer === other) {}",
    "if (secretary === name) {}",
    "if (token < limit) {}",
    "const matches = timingSafeEqual(Buffer.from(token), Buffer.from(expected));",
  ],
  invalid: [
    {
      code: "if (token === expected) {}",
      errors: [{ ...error, data: { name: "token", operator: "===" } }],
    },
    {
      code: "if (request.headers.signature !== computed) {}",
      errors: [{ ...error, data: { name: "signature", operator: "!==" } }],
    },
    {
      code: "if (input == user.passwordHash) {}",
      errors: [{ ...error, data: { name: "passwordHash", operator: "==" } }],
    },
    { code: "if (apiKey != provided) {}", errors: [error] },
    { code: "if (provided === process.env.API_KEY) {}", errors: [error] },
    { code: "if (provided === config.x_api_key) {}", errors: [error] },
    { code: "if (provided === config.apikey) {}", errors: [error] },
    { code: "if (provided === WEBHOOK_SECRET) {}", errors: [error] },
    { code: "if (provided === client_secret) {}", errors: [error] },
    {
      code: "class Client { #accessToken = ''; matches(provided: string) { return provided === this.#accessToken; } }",
      errors: [error],
    },
    { code: 'if (provided === headers["x-hub-signature"]) {}', errors: [error] },
    { code: "if (hmac.digest('hex') === sha256Digest) {}", errors: [error] },
    { code: "if ((stored as string) === hashedPassword) {}", errors: [error] },
    { code: "if (password === 'correct-horse') {}", errors: [error] },
    { code: "if (token === '(') {}", errors: [error] },
    { code: "if (user?.apiKey === provided) {}", errors: [error] },
    { code: 'if (request.headers?.["x-signature"] !== expected) {}', errors: [error] },
    { code: "if (provided === secretKey) {}", errors: [error] },
    { code: "if (provided === SECRET_KEY) {}", errors: [error] },
    { code: "if (hash1 === hash2) {}", errors: [error] },
    { code: 'if (headers["Access-Token"] === provided) {}', errors: [error] },
  ],
});
