import { ruleTester } from "../shared/rule-tester.ts";
import { noUncheckedFetchResponse } from "./no-unchecked-fetch-response.ts";

const error = { messageId: "unchecked" };

ruleTester.run("no-unchecked-fetch-response", noUncheckedFetchResponse, {
  valid: [
    "async function load() { const response = await fetch(url); if (!response.ok) { throw new LoadError(response.status); } return schema.parse(await response.json()); }",
    "async function load() { const response = await fetch(url); return readJson(response); }",
    "async function load() { const response = await fetch(url); return response; }",
    "async function load() { const response = await fetch(url); const body = await response.json(); if (response.status !== 200) { throw new LoadError(body); } return body; }",
    "async function load() { return fetch(url).then((response) => (response.ok ? response.json() : null)); }",
    "async function load(fetch: Fetcher) { const response = await fetch(url); return response.json(); }",
    "async function load() { const response = await client.fetch(url); return response.json(); }",
  ],
  invalid: [
    {
      code: "async function load() { const response = await fetch(url); return response.json(); }",
      errors: [error],
    },
    {
      code: "async function load() { const response = await fetch(url); console.info(`status ${response.status}`); return response.json(); }",
      errors: [error],
    },
    {
      code: "async function load() { const bios = await (await fetch(url)).json(); return bios; }",
      errors: [error],
    },
    {
      code: "function load() { return fetch(url).then((response) => response.json()); }",
      errors: [error],
    },
    {
      code: "async function load() { const response = await globalThis.fetch(url, { method: 'DELETE' }); await response.text(); }",
      errors: [error],
    },
    {
      code: "async function load() { const response = await fetch(url); log(response.headers.get('etag')); return (response as Response)['json'](); }",
      errors: [error],
    },
    {
      code: "function load() { return fetch(url).then((response) => response.json(), handleError); }",
      errors: [error],
    },
  ],
});
