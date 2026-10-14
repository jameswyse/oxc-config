import { ruleTester } from "../shared/rule-tester.ts";
import { noUnsettledPromise } from "./no-unsettled-promise.ts";

ruleTester.run("no-unsettled-promise", noUnsettledPromise, {
  valid: [
    "export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));",
    "export const read = () => new Promise((resolve, reject) => stream.on('end', resolve).on('error', reject));",
    "export const forever = new Promise(() => {});",
    "export const unsupported = new Promise(() => { throw new Error('unsupported'); });",
    "export const pending = new Promise(() => undefined);",
    "export const pending = new Promise(() => void 0);",
    "export function close(server: Server) { return new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))); }",
    "export const settle = new Promise(function (resolve) { queue.push(resolve); });",
    "export const ready = new Promise(({ resolve }) => resolve());",
    "class Promise {} export const custom = new Promise(() => { start(); });",
    "export const stop = () => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));",
  ],
  invalid: [
    {
      code: "export function send(event: Event) { return new Promise(() => { cfn.send(event); }); }",
      errors: [{ messageId: "unsettled" }],
    },
    {
      code: "export const send = () => new Promise((resolve, reject) => { client.send(payload); });",
      errors: [{ messageId: "unsettled" }],
    },
    {
      code: "export const stop = () => new Promise((resolve) => server?.close(resolve));",
      errors: [{ messageId: "optional" }],
    },
    {
      code: "export const stop = () => new Promise<void>((resolve) => { server.close?.(() => resolve()); });",
      errors: [{ messageId: "optional" }],
    },
  ],
});
