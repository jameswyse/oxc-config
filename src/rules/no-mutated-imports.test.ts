import { ruleTester } from "../shared/rule-tester.ts";
import { noMutatedImports } from "./no-mutated-imports.ts";

const mutation = [{ messageId: "mutation" }];
const settings = 'import { settings } from "./settings";';

ruleTester.run("no-mutated-imports", noMutatedImports, {
  valid: [
    `${settings} function setup() { const settings = { retries: 1 }; settings.retries = 0; }`,
    `${settings} test("retries", (settings) => { settings.retries = 0; delete settings.region; });`,
    `${settings} const copy = { ...settings }; copy.retries = 0; delete copy.region;`,
    `${settings} const merged = Object.assign({}, settings, { retries: 0 });`,
    `${settings} let current = settings; current = { ...settings }; current.retries = 0;`,
    `${settings} const retries = settings.retries; const region = Reflect.get(settings, "region"); const keys = Object.keys(settings);`,
    `${settings} expect(settings.retries).toBe(1);`,
    'import { queue } from "./queue"; queue.items.push(job);',
    'import { cache } from "./cache"; cache.set("user", user); cache.entries.clear();',
    'import process from "node:process"; process.env.MODE = "test"; delete process.env.API_URL;',
    'import * as process from "process"; process.env.MODE = "test"; Object.assign(process.env, { MODE: "test" });',
    'import { env } from "node:process"; env.MODE = "test"; Reflect.deleteProperty(env, "API_URL");',
    'import { env } from "process"; afterEach(() => Object.assign(env, original));',
    'import * as childProcess from "node:child_process"; const realSpawn = childProcess.spawn; childProcess.spawn = realSpawn;',
    'import NodeWS from "ws"; const pause = NodeWS.WebSocket.prototype.pause; afterEach(() => { NodeWS.WebSocket.prototype.pause = pause; });',
    `${settings} let saved = settings.retries; settings.retries = saved;`,
    `${settings} let current = settings.session; current = {}; current.id = 1;`,
    `${settings} const session = structuredClone(settings.session); session.id = 1;`,
    `${settings} const { ...rest } = settings; rest.retries = 0; const [...items] = settings.items; items.length = 0;`,
    'import config, { item } from "./settings"; const alias = config.item; const saved = config.item.run; alias.run = saved;',
    `${settings} const { retries } = settings; afterEach(() => { settings.retries = retries; });`,
    `${settings} const { user = {} } = settings; user.role = "admin"; const [first = {}] = settings.items; first.done = true;`,
    `${settings} const { session: { user } = {} } = settings; user.role = "admin";`,
    "import.meta.env.MODE = 'test';",
    "window.settings.retries = 0; globalThis.config = {}; delete window.config;",
    "Object.assign(window, { innerWidth: 500 });",
    "settings.retries = 0;",
    "const settings = { retries: 1 }; settings.retries = 0; Object.assign(settings, { retries: 2 });",
    'const Object = { assign() {} }; import { settings } from "./settings"; Object.assign(settings, { retries: 0 });',
  ],
  invalid: [
    { code: `${settings} settings.retries = 0;`, errors: mutation },
    {
      code: 'import { session } from "./session"; session.user.role = "admin";',
      errors: mutation,
    },
    { code: 'import { queue } from "./queue"; queue.items.length = 0;', errors: mutation },
    { code: 'import { counters } from "./counters"; counters.total += 1;', errors: mutation },
    {
      code: `${settings} settings.retries ||= 3; settings.region ??= "au";`,
      errors: [...mutation, ...mutation],
    },
    {
      code: 'import { counters } from "./counters"; counters.total++; --counters.pending;',
      errors: [...mutation, ...mutation],
    },
    { code: `${settings} settings[key] = 0;`, errors: mutation },
    { code: `${settings} delete settings.region;`, errors: mutation },
    { code: `${settings} Object.assign(settings, { retries: 0 });`, errors: mutation },
    {
      code: `${settings} Object.defineProperty(settings, "retries", { value: 0 });`,
      errors: mutation,
    },
    {
      code: `${settings} Object.defineProperties(settings, { retries: { value: 0 } });`,
      errors: mutation,
    },
    { code: `${settings} Reflect.set(settings, "retries", 0);`, errors: mutation },
    {
      code: `${settings} Reflect.defineProperty(settings, "retries", { value: 0 });`,
      errors: mutation,
    },
    { code: `${settings} Reflect.deleteProperty(settings, "region");`, errors: mutation },
    {
      code: 'import { api } from "./api"; Object.assign(api.defaults, { timeout: 1 });',
      errors: mutation,
    },
    { code: 'import settings from "./settings"; settings.retries = 0;', errors: mutation },
    { code: 'import * as api from "./api"; api.defaults.timeout = 1;', errors: mutation },
    { code: 'const settings = require("./settings"); settings.retries = 0;', errors: mutation },
    { code: `${settings} const alias = settings; alias.retries = 0;`, errors: mutation },
    {
      code: `${settings} beforeEach(() => { settings.retries = 0; }); test("retries", () => { delete settings.region; });`,
      errors: [...mutation, ...mutation],
    },
    {
      code: `${settings} const original = { ...settings }; afterEach(() => Object.assign(settings, original));`,
      errors: mutation,
    },
    {
      code: 'import { mailer } from "./mailer"; mailer.transport = transport;',
      errors: mutation,
    },
    { code: `${settings} (settings as Settings).retries = 0;`, errors: mutation },
    { code: 'import { mailer } from "./mailer"; mailer.send = async () => {};', errors: mutation },
    {
      code: 'import { mailer } from "./mailer"; function send() {} mailer.transport.send = send;',
      errors: mutation,
    },
    {
      code: 'import { mailer } from "./mailer"; const send = () => {}; mailer.send = send;',
      errors: mutation,
    },
    {
      code: 'import { vi } from "vitest"; import { mailer } from "./mailer"; mailer.send = vi.fn();',
      errors: mutation,
    },
    {
      code: 'import { mailer } from "./mailer"; Object.defineProperty(mailer, "send", { value: async () => {} });',
      errors: mutation,
    },
    {
      code: 'import { mailer } from "./mailer"; Reflect.defineProperty(mailer, "user", { get: () => user });',
      errors: mutation,
    },
    { code: 'import { mailer } from "./mailer"; mailer[key] = async () => {};', errors: mutation },
    { code: 'import { client } from "./client"; client.onready = () => {};', errors: mutation },
    { code: 'import { socket } from "./socket"; socket.onMessage = () => {};', errors: mutation },
    {
      code: 'import { vi } from "vitest"; import * as navigation from "next/navigation"; navigation.useSearchParams = vi.fn().mockReturnValue(params);',
      errors: mutation,
    },
    {
      code: 'import whichPkg from "which"; whichPkg.sync = Object.assign((cmd) => cmd, sync);',
      errors: mutation,
    },
    {
      code: 'import * as childProcess from "node:child_process"; const realSpawn = childProcess.spawn; childProcess.spawn = fakeSpawn; childProcess.spawn = realSpawn;',
      errors: [{ messageId: "mutation", line: 1, column: 90 }],
    },
    {
      code: 'import config, { item } from "./settings"; const alias = config.item; const saved = item.run; alias.run = saved;',
      errors: mutation,
    },
    {
      code: `${settings} const { retries } = settings; settings.retries = 0; afterEach(() => { settings.retries = retries; });`,
      errors: mutation,
    },
    {
      code: 'import { mailer } from "./mailer"; const { send: original } = mailer; mailer.send = fake; mailer.send = original;',
      errors: mutation,
    },
    {
      code: 'import * as mod from "./mailer"; import { mailer } from "./mailer"; const original = mod.mailer.send; mailer.send = fake; mailer.send = original;',
      errors: mutation,
    },
    {
      code: 'import { mailer } from "./mailer"; const original = mailer.transport; mailer.transport.send = fake; mailer.transport.send = original.send;',
      errors: [...mutation, ...mutation],
    },
    {
      code: 'import * as mod from "./mailer"; import { send } from "./mailer"; mod.send = fake; mod.send = send;',
      errors: [...mutation, ...mutation],
    },
    {
      code: `${settings} let saved = settings.retries; saved = 2; settings.retries = saved;`,
      errors: mutation,
    },
    {
      code: `${settings} const retries = settings.retries; settings.region = retries;`,
      errors: mutation,
    },
    {
      code: 'import { session } from "./session"; const original = session.user; session.user.role = original;',
      errors: mutation,
    },
    { code: `${settings} const session = settings.session; session.id = 1;`, errors: mutation },
    {
      code: 'import { session } from "./session"; const { user } = session; user.role = "admin";',
      errors: mutation,
    },
    { code: `${settings} let current = settings; current.retries = 0;`, errors: mutation },
    {
      code: 'import { queue } from "./queue"; const [first] = queue.items; first.done = true;',
      errors: mutation,
    },
    {
      code: 'import { session } from "./session"; [session.a, session.b] = [1, 2];',
      errors: mutation,
    },
    {
      code: 'import { session } from "./session"; ({ a: session.a, ...session.rest } = value);',
      errors: mutation,
    },
    { code: 'import { session } from "./session"; delete session?.token;', errors: mutation },
  ],
});
