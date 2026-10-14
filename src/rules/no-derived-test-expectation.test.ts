import { ruleTester } from "../shared/rule-tester.ts";
import { noDerivedTestExpectation } from "./no-derived-test-expectation.ts";

const error = { messageId: "derived" };

function test(code: string) {
  return { code, filename: "/project/src/members/activity.test.ts" };
}

ruleTester.run("no-derived-test-expectation", noDerivedTestExpectation, {
  valid: [
    test(
      'import { expect, test } from "vitest"; import { describeActivity } from "./activity.ts"; test("describes", () => { expect(describeActivity(input)).toBe("Registration failed"); });',
    ),
    test(
      'import { expect, test } from "vitest"; import { buildMember } from "../testing/members.ts"; import { save } from "./activity.ts"; test("saves", () => { expect(save(input)).toEqual(buildMember()); });',
    ),
    test(
      'import { expect, test } from "vitest"; import { directory } from "./directory.ts"; test("separates", () => { expect(directory("dev")).not.toBe(directory("prod")); });',
    ),
    test(
      'import { expect, test } from "vitest"; import { move } from "./layout.ts"; test("ignores missing groups", () => { expect(move(move(layout, a), b)).toEqual(move(layout, a)); });',
    ),
    test(
      'import { expect, test } from "vitest"; import { parse } from "zod-helpers"; test("parses", () => { expect(value).toEqual(parse(input)); });',
    ),
    test(
      'import { expect, test } from "vitest"; import { sources } from "./sources.ts"; test("lists", () => { expect(keys).toEqual(sources.definitions.map(({ key }) => key)); });',
    ),
    test(
      'import { expect, test } from "vitest"; import { git } from "../../tools/e2e/repositories.ts"; test("clones", () => { expect(git(checkout)).toBe(git(source)); });',
    ),
    test(
      'import { expect, test } from "vitest"; import { format } from "./format.ts"; test("formats", () => { const actual = format(input); expect(actual).toBe(format(other)); });',
    ),
    test(
      'import { expect, it } from "vitest"; import { createSnapshot } from "./snapshot.ts"; it("restores", () => { const persisted = createSnapshot(form); entry.write(persisted); expect(entry.read()).toEqual(persisted); });',
    ),
  ],
  invalid: [
    {
      ...test(
        'import { expect, test } from "vitest"; import { describeActivity } from "./activity.ts"; import { registrationErrorMeaning } from "./registration.ts"; test("describes", () => { expect(describeActivity(input).description).toBe(registrationErrorMeaning(code)); });',
      ),
      errors: [error],
    },
    {
      ...test(
        'import { expect, test } from "vitest"; import { colourStyles } from "@/calendar/colours"; test("colours", () => { expect(style.backgroundColor).toBe(colourStyles("#123456").backgroundColor); });',
      ),
      errors: [error],
    },
    {
      ...test(
        'import { expect, it } from "vitest"; import { backupName } from "./backup.ts"; it("lists", async () => { await expect(list()).resolves.toEqual([backupName("production", time)]); });',
      ),
      errors: [error],
    },
    {
      ...test(
        'import { expect, test } from "vitest"; import { format } from "./format.ts"; import { render } from "./render.ts"; test("renders", () => { const expected = format(input); expect(render(input)).toBe(expected); });',
      ),
      errors: [error],
    },
    {
      ...test(
        'import { expect, test } from "vitest"; import * as formatter from "./format.ts"; import { render } from "./render.ts"; test("renders", () => { expect(render(input)).toBe(formatter.format(input)); });',
      ),
      errors: [error],
    },
  ],
});
