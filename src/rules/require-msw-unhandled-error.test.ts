import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";

import { write } from "../shared/config.test-utils.ts";
import { ruleTester } from "../shared/rule-tester.ts";
import { requireMswUnhandledError } from "./require-msw-unhandled-error.ts";

const root = mkdtempSync(join(tmpdir(), "require-msw-unhandled-error-"));

after(() => rmSync(root, { recursive: true, force: true }));

function installMsw(directory: string, version: string) {
  write(directory, "node_modules/msw/package.json", JSON.stringify({ name: "msw", version }));
}

installMsw(join(root, "msw-2"), "2.15.0");
installMsw(join(root, "msw-3"), "3.0.7");
installMsw(join(root, "msw-3/packages/legacy"), "2.15.0");

const mswTwo = join(root, "msw-2/src/setup.ts");
const mswThree = join(root, "msw-3/src/setup.ts");
const hoistedMswTwo = join(root, "msw-2/packages/app/src/setup.ts");
const nestedMswTwo = join(root, "msw-3/packages/legacy/src/setup.ts");
const withoutMsw = join(root, "without-msw/src/setup.ts");

const server = 'import { setupServer } from "msw/node";\nconst server = setupServer();\n';

const worker = 'import { setupWorker } from "msw/browser";\nconst worker = setupWorker();\n';

const lenient = [{ messageId: "lenient" }];

const needsRequest = [{ messageId: "lenient", data: { option: "onUnhandledRequest" } }];

const needsFrame = [{ messageId: "lenient", data: { option: "onUnhandledFrame" } }];

const mswTwoValid = [
  `${server}server.listen({ onUnhandledRequest: "error" });`,
  `${server}beforeAll(() => server.listen({ onUnhandledRequest: "error" }));`,
  `${server}server.listen({ onUnhandledRequest: \`error\` });`,
  `${server}const mode = "error";\nserver.listen({ onUnhandledRequest: mode });`,
  `${server}server.listen({ onUnhandledRequest: "error" as const });`,
  `${server}server.listen({ onUnhandledRequest(request, print) { print.error(); } });`,
  `${server}server.listen({ onUnhandledRequest: (request, print) => print.error() });`,
  `${server}function failOnUnhandled() {}\nserver.listen({ onUnhandledRequest: failOnUnhandled });`,
  `${server}const failOnUnhandled = () => {};\nserver.listen({ onUnhandledRequest: failOnUnhandled });`,
  `${server}import { failOnUnhandled } from "./unhandled";\nserver.listen({ onUnhandledRequest: failOnUnhandled });`,
  `${server}const options = { onUnhandledRequest: "error" };\nserver.listen(options);`,
  `${worker}await worker.start({ onUnhandledRequest: "error", quiet: true });`,
  'import { setupServer } from "msw/node";\nsetupServer().listen({ onUnhandledRequest: "error" });',
  'import { setupServer } from "msw/node";\nlet server;\nserver = setupServer();\nserver.listen({ onUnhandledRequest: "error" });',
  'import { http } from "msw";\nimport { server } from "./mocks/server";\nserver.listen();',
  'import { setupServer } from "./msw";\nconst server = setupServer();\nserver.listen();',
  'import { setupServer } from "mswjs-helpers";\nconst server = setupServer();\nserver.listen();',
  'import { setupServer } from "msw/node";\nconst app = createApp();\napp.listen(3000);',
  'import { setupServer } from "msw/node";\nconst worker = setupServer();\nworker.start();',
  'import { setupWorker } from "msw/browser";\nconst server = setupWorker();\nserver.listen();',
  'import { setupServer } from "msw/node";\nlet server = setupServer();\nserver = createServer();\nserver.listen();',
  'import { setupServer } from "msw/node";\nfunction start(server) { server.listen(); }',
  "const server = setupServer();\nserver.listen();",
  'import { setupServer } from "msw/node";\nconst server = setupServer();\nserver.listen(...args);',
  'import { setupServer } from "msw/node";\nfunction f() { const setupServer = () => app; setupServer().listen(); }',
  `${server}const strictDefaults = { onUnhandledRequest: "error" } as const;\nserver.listen({ ...strictDefaults });`,
  `${server}server.listen({ onUnhandledRequest: "warn", ...{ onUnhandledRequest: "error" } });`,
  `${server}const base = { quiet: true };\nserver.listen({ onUnhandledRequest: "error", ...base });`,
  `${server}const base = { onUnhandledRequest: "error" };\nserver.listen({ ...base, ...base });`,
  `${server}const strictDefaults = { onUnhandledRequest: "error" };\nconst options = strictDefaults;\nserver.listen(options);`,
  `${server}import { options } from "./msw-options";\nserver.listen(options);`,
  `${server}function start(options) { server.listen(options); }`,
  `${server}server.listen(options);`,
  `${server}import { defaults } from "./msw-options";\nserver.listen({ onUnhandledRequest: "warn", ...defaults });`,
  `${server}import { defaults } from "./msw-options";\nserver.listen({ ...defaults });`,
  `${server}server.listen({ ...getDefaults() });`,
  `${server}server.listen({ onUnhandledRequest: mode });`,
  `${server}import { mode } from "./msw-options";\nserver.listen({ onUnhandledRequest: mode });`,
  `${server}server.listen({ onUnhandledRequest: config.mode });`,
  `${server}server.listen({ [key]: "warn" });`,
  `${server}const alias = server;\nalias.listen({ onUnhandledRequest: "error" });`,
  'const { setupServer } = require("msw/node");\nconst server = setupServer();\nserver.listen({ onUnhandledRequest: "error" });',
  'const { setupServer } = require("./msw");\nconst server = setupServer();\nserver.listen();',
  'import { setupServer } from "msw/node";\nlet server = setupServer();\nserver = undefined;\nserver.listen({ onUnhandledRequest: "error" });',
  'import { setupServer } from "msw/node";\nlet server = null;\nserver.listen();',
  `${server}server.listen(process.env.CI ? { onUnhandledRequest: "error" } : options);`,
  `${server}server.listen(options ?? { onUnhandledRequest: "error" });`,
  `${server}server.listen(process.env.CI ? { onUnhandledRequest: "error" } : { onUnhandledRequest: failOnUnhandled });`,
  `${server}var options = { ...options, quiet: true };\nserver.listen(options);`,
  `${server}const defaults = { ...defaults };\nserver.listen(defaults);`,
  `${server}server.listen({ onUnhandledRequest: undefined, ...{ onUnhandledRequest: "error" } });`,
  `${server}server.listen({ ...undefined, ...null, onUnhandledRequest: "error" });`,
  `${server}const options = process.env.CI ? { onUnhandledRequest: "error" } : undefined;\nconst strict = { onUnhandledRequest: "error" };\nserver.listen(options ?? strict);`,
  `${server}const options = process.env.CI ? { onUnhandledRequest: "error" } : null;\nserver.listen(options || { onUnhandledRequest: "error" });`,
  `${server}const options = { onUnhandledRequest: "warn" };\noptions.onUnhandledRequest = "error";\nserver.listen(options);`,
  `${server}server.listen({ onUnhandledRequest: process.env.CI ? "error" : () => {} });`,
  `${server}server.listen({ onUnhandledRequest: mode ?? "error" });`,
];

const mswTwoInvalid = [
  { code: `${server}server.listen();`, errors: needsRequest },
  { code: `${server}beforeAll(() => server.listen());`, errors: lenient },
  { code: `${server}server.listen({ onUnhandledRequest: "warn" });`, errors: lenient },
  { code: `${server}server.listen({ onUnhandledRequest: "bypass" });`, errors: lenient },
  {
    code: `${server}server.listen({ onUnhandledRequest: process.env.CI ? "error" : "warn" });`,
    errors: lenient,
  },
  { code: `${server}server.listen({ quiet: true });`, errors: lenient },
  {
    code: `${server}const options = { onUnhandledRequest: "warn" };\nserver.listen(options);`,
    errors: lenient,
  },
  { code: `${worker}await worker.start();`, errors: lenient },
  { code: `${worker}await worker.start({ quiet: true });`, errors: lenient },
  {
    code: 'import { setupServer } from "msw/node";\nsetupServer(...handlers).listen();',
    errors: lenient,
  },
  {
    code: 'import { setupServer as mockServer } from "msw/node";\nconst server = mockServer();\nserver.listen();',
    errors: lenient,
  },
  {
    code: 'import * as mswNode from "msw/node";\nconst server = mswNode.setupServer();\nserver.listen();',
    errors: lenient,
  },
  {
    code: 'import { setupWorker } from "msw";\nconst worker = setupWorker();\nworker.start();',
    errors: lenient,
  },
  {
    code: 'import { setupServer } from "msw/node";\nlet server;\nbeforeAll(() => {\n  server = setupServer();\n  server.listen();\n});',
    errors: lenient,
  },
  {
    code: 'import { setupServer } from "msw/node";\nexport const server = setupServer();\nserver.listen();',
    errors: lenient,
  },
  {
    code: `${server}server.listen({ onUnhandledRequest: "error", ...{ onUnhandledRequest: "warn" } });`,
    errors: lenient,
  },
  {
    code: `${server}const lenientDefaults = { onUnhandledRequest: "bypass" };\nserver.listen({ quiet: true, ...lenientDefaults });`,
    errors: lenient,
  },
  {
    code: `${server}import { defaults } from "./msw-options";\nserver.listen({ ...defaults, onUnhandledRequest: "warn" });`,
    errors: lenient,
  },
  {
    code: `${server}const base = { quiet: true };\nserver.listen({ ...base });`,
    errors: lenient,
  },
  {
    code: `${server}const base = { quiet: true };\nconst options = base;\nserver.listen(options);`,
    errors: lenient,
  },
  {
    code: `${server}server.listen({ onUnhandledRequest: process.env.CI ? "warn" : failOnUnhandled });`,
    errors: lenient,
  },
  { code: `${server}const alias = server;\nalias.listen();`, errors: lenient },
  {
    code: `${server}const alias = server;\nconst other = alias;\nother.listen();`,
    errors: lenient,
  },
  {
    code: 'import { setupServer } from "msw/node";\nlet server = setupServer();\nserver.listen();\nserver = undefined;',
    errors: lenient,
  },
  {
    code: 'import { setupServer } from "msw/node";\nlet server;\nbeforeAll(() => {\n  server = setupServer();\n  server.listen();\n});\nafterAll(() => {\n  server = null;\n});',
    errors: lenient,
  },
  {
    code: 'const { setupServer } = require("msw/node");\nconst server = setupServer();\nserver.listen();',
    errors: lenient,
  },
  {
    code: 'const msw = require("msw/node");\nconst server = msw.setupServer();\nserver.listen();',
    errors: lenient,
  },
  {
    code: 'const { setupWorker } = require("msw/browser");\nconst worker = setupWorker();\nworker.start();',
    errors: lenient,
  },
  {
    code: 'const { setupServer } = require("msw");\nsetupServer().listen();',
    errors: lenient,
  },
  { code: `${server}server.listen(undefined);`, errors: lenient },
  { code: `${server}server.listen({ onUnhandledRequest: undefined });`, errors: lenient },
  {
    code: `${server}server.listen({ onUnhandledRequest: "error", ...{ onUnhandledRequest: undefined } });`,
    errors: lenient,
  },
  {
    code: `${server}server.listen(process.env.CI ? { onUnhandledRequest: "error" } : {});`,
    errors: lenient,
  },
  {
    code: `${server}server.listen(process.env.CI ? options : { onUnhandledRequest: "warn" });`,
    errors: lenient,
  },
  {
    code: `${server}server.listen(options || { quiet: true });`,
    errors: lenient,
  },
  {
    code: `${server}const options = process.env.CI ? { onUnhandledRequest: "error" } : undefined;\nserver.listen(options);`,
    errors: lenient,
  },
  {
    code: `${server}var options = { ...options, onUnhandledRequest: "warn" };\nserver.listen(options);`,
    errors: lenient,
  },
  {
    code: `${server}server.listen({ onUnhandledRequest: process.env.CI ? "error" : undefined });`,
    errors: lenient,
  },
  {
    code: `${server}server.listen({ onUnhandledRequest: mode || "warn" });`,
    errors: lenient,
  },
  {
    code: `${server}const options = process.env.CI ? { onUnhandledRequest: "error" } : undefined;\nserver.listen(options ?? { quiet: true });`,
    errors: lenient,
  },
];

ruleTester.run("require-msw-unhandled-error", requireMswUnhandledError, {
  valid: [
    ...mswTwoValid.map((code) => ({ code, filename: mswTwo })),
    { code: `${server}server.listen({ onUnhandledFrame: "error" });`, filename: mswThree },
    {
      code: `${worker}await worker.start({ onUnhandledFrame: "error", quiet: true });`,
      filename: mswThree,
    },
    {
      code: `${server}server.listen({ onUnhandledFrame() { throw new Error("Unhandled request"); } });`,
      filename: mswThree,
    },
    {
      code: `${server}const options = { onUnhandledFrame: "error" };\nserver.listen(options);`,
      filename: mswThree,
    },
    { code: `${server}server.listen({ onUnhandledRequest: "error" });`, filename: hoistedMswTwo },
    { code: `${server}server.listen({ onUnhandledRequest: "error" });`, filename: nestedMswTwo },
    { code: `${server}server.listen({ onUnhandledFrame: "error" });`, filename: withoutMsw },
  ],
  invalid: [
    ...mswTwoInvalid.map((testCase) => ({ ...testCase, filename: mswTwo })),
    {
      code: `${server}server.listen({ onUnhandledFrame: "error" });`,
      filename: mswTwo,
      errors: needsRequest,
    },
    { code: `${server}server.listen();`, filename: mswThree, errors: needsFrame },
    {
      code: `${server}server.listen({ onUnhandledRequest: "error" });`,
      filename: mswThree,
      errors: needsFrame,
    },
    {
      code: `${server}server.listen({ onUnhandledFrame: "warn" });`,
      filename: mswThree,
      errors: needsFrame,
    },
    {
      code: `${worker}await worker.start({ onUnhandledFrame: "bypass" });`,
      filename: mswThree,
      errors: needsFrame,
    },
    {
      code: `${server}server.listen({ onUnhandledFrame: "error" });`,
      filename: hoistedMswTwo,
      errors: needsRequest,
    },
    {
      code: `${server}server.listen({ onUnhandledFrame: "error" });`,
      filename: nestedMswTwo,
      errors: needsRequest,
    },
    {
      code: `${server}server.listen({ onUnhandledRequest: "error" });`,
      filename: withoutMsw,
      errors: needsFrame,
    },
  ],
});
