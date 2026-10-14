import { ruleTester } from "../shared/rule-tester.ts";
import { noImportTimeEffects } from "./no-import-time-effects.ts";

const error = { messageId: "effect" };

ruleTester.run("no-import-time-effects", noImportTimeEffects, {
  valid: [
    "export function openLayoutChannel() { return new BroadcastChannel('layouts'); }",
    "export const startClock = () => setInterval(tick, 1000);",
    "export class Server { start() { this.server.listen(3000); } }",
    "export const layer = Effect.gen(function* () { yield* Effect.sleep('1 second'); });",
    "const setInterval = (callback: () => void) => callback; setInterval(tick);",
    "export const client = new DynamoDBClient({});",
    "export class Poller { timer = setInterval(poll, 1000); }",
    "export const messages = (function* () { yield new WebSocket(url); })();",
  ],
  invalid: [
    { code: "export const channel = new BroadcastChannel('layouts');", errors: [error] },
    { code: "setInterval(() => { now = Date.now(); }, 1000);", errors: [error] },
    { code: "window.addEventListener('message', handleMessage);", errors: [error] },
    { code: "process.on('SIGTERM', shutdown);", errors: [error] },
    { code: "export const config = await loadConfig();", errors: [error] },
    { code: "app.listen(3000);", errors: [error] },
    { code: "export const bios = fetch('/api/bios').then(read);", errors: [error] },
    { code: "void (async () => { await fetch('/api/warm'); })();", errors: [error] },
    { code: "export class Poller { static timer = setInterval(poll, 1000); }", errors: [error] },
    { code: "export class Poller { [setInterval(poll, 1000)] = true; }", errors: [error] },
    { code: "export class Bus { static { new BroadcastChannel('bus'); } }", errors: [error] },
    {
      code: "export namespace Clock { export const timer = setInterval(tick, 1000); }",
      errors: [error],
    },
  ],
});
