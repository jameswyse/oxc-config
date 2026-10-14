import { ruleTester } from "../shared/rule-tester.ts";
import { noOptionalTestAction } from "./no-optional-test-action.ts";

const error = { messageId: "optional" };

ruleTester.run("no-optional-test-action", noOptionalTestAction, {
  valid: [
    'import { test } from "vitest"; test("selects", () => { screen.getByRole("button", { name: "Select" }).click(); });',
    'import { afterEach } from "vitest"; afterEach(() => { server?.close(); });',
    'import { test } from "vitest"; test("reads", () => { const label = button?.textContent; expect(label).toBe("Save"); });',
    "export function cleanup() { server?.close(); }",
    'import { test } from "vitest"; test("batches", async () => { const run = vi.fn(async () => { if (started === 2) release?.(); }); await run(); });',
    'import { test } from "vitest"; test("waits", async () => { await expect(page.getByRole("dialog")).toBeVisible(); });',
  ],
  invalid: [
    {
      code: 'import { test } from "vitest"; test("selects", () => { buttons[1]?.click(); });',
      errors: [error],
    },
    {
      code: 'import { it } from "vitest"; it("dismisses", async () => { await dismiss?.click(); });',
      errors: [error],
    },
    {
      code: 'import { it } from "vitest"; it("dismisses", async () => { await dialog?.close!(); });',
      errors: [error],
    },
    {
      code: 'test("focuses", () => { const input = container.querySelector("input"); input?.focus(); });',
      errors: [error],
    },
    {
      code: 'import { test } from "@playwright/test"; test("submits", async ({ page }) => { onSubmit?.(); });',
      errors: [error],
    },
    {
      code: 'import { test } from "vitest"; test("selects", () => button?.click());',
      errors: [error],
    },
    {
      code: 'import { it } from "vitest"; it("dismisses", async () => { return await dismiss?.click(); });',
      errors: [error],
    },
  ],
});
