import { ruleTester } from "../shared/rule-tester.ts";
import { noRecorderPolling } from "./no-recorder-polling.ts";

const vitest = 'import { expect, vi } from "vitest";\n';

const playwright = 'import { expect } from "@playwright/test";\n';

const rtl = 'import { waitFor } from "@testing-library/react";\n';

const requests =
  'const requests = [];\nserver.events.on("request:start", ({ request }) => requests.push(request));\n';

const seen = 'const seen = new Set();\nemitter.on("change", (value) => seen.add(value));\n';

const poll = [{ messageId: "poll" }];

ruleTester.run("no-recorder-polling", noRecorderPolling, {
  valid: [
    `${playwright}await expect.poll(() => page.locator("li").count()).toBe(3);`,
    `${playwright}await expect.poll(async () => (await fetch(url)).status).toBe(200);`,
    `${vitest}await expect.poll(() => screen.getAllByRole("row").length).toBe(3);`,
    `${vitest}await expect.poll(() => screen.getAllByRole("row")).toHaveLength(3);`,
    `${vitest}await expect.poll(() => status).toBe("ready");`,
    `${vitest}await expect.poll(() => store.state.status).toBe("ready");`,
    `${vitest}${requests}await expect.poll(() => requests).toEqual([]);`,
    `${vitest}await expect.poll(() => listRef.current.length).toBe(2);`,
    `${vitest}await expect.poll(() => callbackRef.current).toHaveBeenCalled();`,
    `${vitest}${requests}await expect.poll(() => { const count = requests.length; return count; }).toBe(2);`,
    `${vitest}await vi.waitFor(() => expect(screen.getByText("Saved")).toBeVisible());`,
    `${vitest}await vi.waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(3));`,
    `${vitest}await vi.waitFor(() => expect(getCalls()).toHaveLength(1));`,
    `${vitest}await vi.waitFor(() => expect(status).toBe("ready"));`,
    `${vitest}await vi.waitFor(() => { if (!ready) throw new Error("not ready"); });`,
    `${vitest}await vi.waitFor(() => { expect(spy).toHaveBeenCalled(); expect(screen.getByText("Saved")).toBeVisible(); });`,
    `${vitest}await vi.waitFor(() => {});`,
    `${vitest}await vi.waitFor(() => expect(ref.current).toHaveBeenCalled());`,
    `${vitest}await vi.waitFor(waitForRequests);`,
    `${rtl}await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());`,
    'import { waitFor } from "./helpers";\nawait waitFor(() => expect(spy).toHaveBeenCalled());',
    `import { waitFor } from "async-wait-until";\n${requests}await waitFor(() => requests.length > 0);`,
    "await waitFor(() => expect(spy).toHaveBeenCalled());",
    'import { expect } from "chai";\nawait expect.poll(() => spy.mock.calls.length).toBe(1);',
    "const vi = createHelpers();\nawait vi.waitFor(() => expect(spy).toHaveBeenCalled());",
    `${vitest}expect(spy.mock.calls).toHaveLength(1);`,
    `${vitest}${requests}expect(requests).toHaveLength(2);`,
    `${vitest}await expect.poll(() => document.body.children.length).toBe(2);`,
    `${rtl}await waitFor(() => expect(container.children).toHaveLength(2));`,
    `${vitest}await vi.waitFor(() => expect(statusText).toHaveLength(5));`,
    `${vitest}await expect.poll(() => persistentPty.terminals[0]!.size).toEqual(pane());`,
    `${vitest}await expect.poll(() => requests.length).toBe(2);`,
    `${vitest}await expect.poll(() => server.requests.length).toBe(2);`,
    `${vitest}const rows = [1, 2];\nawait expect.poll(() => rows.length).toBe(2);`,
    `${vitest}const queue = [];\nqueue.push(1);\nawait expect.poll(() => queue.length).toBe(1);`,
    `${vitest}const queue = [];\non("x", () => queue.pop());\nawait expect.poll(() => queue.length).toBe(1);`,
    `${vitest}const text = "";\non("x", (value) => text.concat(value));\nawait expect.poll(() => text.length).toBe(1);`,
    `${vitest}import { Set } from "immutable";\nconst seen = new Set();\non("x", (value) => seen.add(value));\nawait expect.poll(() => seen.size).toBe(1);`,
    `${vitest}${requests}function check(requests) { return vi.waitFor(() => requests.length >= 2); }`,
    `${vitest}await expect.poll(() => document.body.children.length > 1).toBe(true);`,
    `${vitest}${requests}await vi.waitFor(() => requests.length + 1);`,
    `${vitest}await expect.poll(() => spy.mock.calls.length === document.body.children.length).toBe(true);`,
    `${vitest}await expect.poll(() => spy.mock.calls.length === Number(document.body.dataset.expectedCalls)).toBe(true);`,
    `${vitest}let expected = 2;\nawait expect.poll(() => spy.mock.calls.length === expected).toBe(true);`,
    `${vitest}const expected = getExpected();\nawait expect.poll(() => spy.mock.calls.length >= expected).toBe(true);`,
    `${vitest}const undefined = getExpected();\nawait expect.poll(() => spy.mock.calls[0] !== undefined).toBe(true);`,
    `${vitest}await expect.poll(() => spy.mock.calls[0] !== void expected).toBe(true);`,
  ],
  invalid: [
    { code: `${vitest}await expect.poll(() => spy.mock.calls.length).toBe(1);`, errors: poll },
    { code: `${vitest}${requests}await expect.poll(() => requests.length).toBe(2);`, errors: poll },
    { code: `${vitest}${seen}await expect.poll(() => seen.size).toBe(1);`, errors: poll },
    {
      code: `${vitest}let events = new Array();\nbeforeEach(() => { events = []; });\nemitter.on("x", (event) => events.unshift(event));\nawait expect.poll(() => events.length).toBe(1);`,
      errors: poll,
    },
    {
      code: `${vitest}const byId = new Map();\nfunction record(id, value) { byId.set(id, value); }\nawait expect.poll(() => byId.size).toBe(1);`,
      errors: poll,
    },
    {
      code: `${vitest}await expect.poll(() => { return spy.mock.calls; }).toEqual([]);`,
      errors: poll,
    },
    {
      code: `${vitest}${seen}await expect.poll(function () { return seen.size; }).toBe(1);`,
      errors: poll,
    },
    {
      code: `${vitest}${requests}await expect.poll(() => requests).toHaveLength(2);`,
      errors: poll,
    },
    { code: `${vitest}await expect.poll(() => spy.mock.calls).toHaveLength(2);`, errors: poll },
    { code: `${vitest}await expect.poll(() => spy).toHaveBeenCalled();`, errors: poll },
    { code: `${vitest}await expect.poll(() => spy).not.toHaveBeenCalled();`, errors: poll },
    {
      code: `${vitest}await expect.poll(() => handlers.onSave).toHaveBeenCalledWith("draft");`,
      errors: poll,
    },
    {
      code: `${playwright}${requests}await expect.poll(() => requests.length).toBe(2);`,
      errors: poll,
    },
    { code: `${requests}await expect.poll(() => requests.length).toBe(2);`, errors: poll },
    {
      code: `import { expect } from "@effect/vitest";\n${requests}await expect.poll(() => requests.length).toBe(2);`,
      errors: poll,
    },
    {
      code: `${vitest}await expect.poll(() => spy.mock.calls.length > 0).toBe(true);`,
      errors: poll,
    },
    { code: `${vitest}${requests}await vi.waitFor(() => requests.length >= 2);`, errors: poll },
    { code: `${vitest}${requests}await vi.waitFor(() => 0 < requests.length);`, errors: poll },
    {
      code: `${vitest}const expected = 2;\nawait expect.poll(() => spy.mock.calls.length === expected).toBe(true);`,
      errors: poll,
    },
    {
      code: `${vitest}await expect.poll(() => spy.mock.calls.length > -1).toBe(true);`,
      errors: poll,
    },
    {
      code: `${vitest}await expect.poll(() => spy.mock.calls[0] !== undefined).toBe(true);`,
      errors: poll,
    },
    {
      code: `${vitest}await expect.poll(() => spy.mock.calls[0] != null).toBe(true);`,
      errors: poll,
    },
    {
      code: `${vitest}await expect.poll(() => spy.mock.calls[0] !== void 0).toBe(true);`,
      errors: poll,
    },
    {
      code: `${vitest}${requests}${seen}await vi.waitFor(() => requests.length === seen.size);`,
      errors: poll,
    },
    {
      code: `${vitest}${seen}await expect.poll(() => !(seen.size === 0)).toBe(true);`,
      errors: poll,
    },
    {
      code: `${vitest}await expect.poll(() => Boolean(spy.mock.calls.length)).toBe(true);`,
      errors: poll,
    },
    {
      code: `${vitest}${requests}await vi.waitFor(() => expect(requests.length > 1).toBe(true));`,
      errors: poll,
    },
    { code: `${vitest}await vi.waitFor(() => expect(spy).toHaveBeenCalled());`, errors: poll },
    {
      code: `${vitest}await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2));`,
      errors: poll,
    },
    { code: `${vitest}await vi.waitFor(() => expect(spy).not.toBeCalled());`, errors: poll },
    {
      code: `${vitest}await vi.waitFor(() => expect(api.save).toHaveBeenLastCalledWith(1));`,
      errors: poll,
    },
    {
      code: `${vitest}await vi.waitFor(() => expect(spy).toHaveBeenNthCalledWith(2, "b"));`,
      errors: poll,
    },
    { code: `${vitest}await vi.waitFor(() => expect(spy).toHaveReturnedWith(1));`, errors: poll },
    { code: `${vitest}await vi.waitFor(() => expect(spy).toHaveResolvedTimes(1));`, errors: poll },
    {
      code: `${vitest}${requests}await vi.waitFor(() => expect(requests).toHaveLength(2));`,
      errors: poll,
    },
    {
      code: `${vitest}await vi.waitFor(() => expect(spy.mock.calls.length).toBe(1));`,
      errors: poll,
    },
    {
      code: `${vitest}${requests}await vi.waitFor(() => expect(requests.length).toBeGreaterThan(0));`,
      errors: poll,
    },
    { code: `${vitest}await vi.waitFor(() => { expect(spy).toHaveBeenCalled(); });`, errors: poll },
    {
      code: `${vitest}await vi.waitFor(() => { expect(spy).toHaveBeenCalled(); expect(other).toHaveBeenCalled(); });`,
      errors: poll,
    },
    {
      code: `${vitest}${requests}await vi.waitFor(() => { expect(spy).toHaveBeenCalledTimes(1); expect(requests).toHaveLength(1); });`,
      errors: poll,
    },
    {
      code: `${vitest}${seen}await vi.waitFor(() => { return expect(seen.size).toBe(1); });`,
      errors: poll,
    },
    { code: `${vitest}${requests}await vi.waitFor(() => requests.length);`, errors: poll },
    { code: "await vi.waitFor(() => expect(spy).toHaveBeenCalled());", errors: poll },
    {
      code: 'import { vi, expect } from "@effect/vitest";\nawait vi.waitFor(() => expect(spy).toHaveBeenCalled());',
      errors: poll,
    },
    {
      code: 'import * as vitest from "vitest";\nawait vitest.vi.waitFor(() => vitest.expect(spy).toHaveBeenCalled());',
      errors: poll,
    },
    { code: `${rtl}await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));`, errors: poll },
    {
      code: 'import { waitFor as waitUntil } from "@testing-library/dom";\nawait waitUntil(() => expect(onSubmit).toHaveBeenCalled());',
      errors: poll,
    },
    {
      code: 'import * as rtl from "@testing-library/react";\nawait rtl.waitFor(() => expect(onSubmit).toHaveBeenCalled());',
      errors: poll,
    },
    {
      code: `${rtl}await waitFor(() => expect(fetchMock.mock.calls).toHaveLength(1));`,
      errors: poll,
    },
  ],
});
