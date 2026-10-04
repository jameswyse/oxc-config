import { ruleTester } from "../shared/rule-tester.ts";
import { serverActionGuard } from "./server-action-guard.ts";

const guarded = [{ guards: ["requireStaff", "requireMember"] }];

ruleTester.run("server-action-guard", serverActionGuard, {
  valid: [
    {
      code: '"use server";\nexport async function save() { await requireStaff(); }',
      options: guarded,
    },
    {
      code: '"use server";\nexport const save = async () => { const staff = await requireMember(); return staff; };',
      options: guarded,
    },
    { code: '"use server";\nexport type Input = { id: string };', options: guarded },
    { code: "export async function save() { return 1; }", options: guarded },
    {
      code: 'export function Page() { async function save() { "use server"; await requireStaff(); } return save; }',
      options: guarded,
    },
    { code: '"use server";\nasync function helper() { return 1; }', options: guarded },
  ],
  invalid: [
    {
      code: '"use server";\nexport async function save() { return 1; }',
      options: guarded,
      errors: [{ messageId: "missingGuard" }],
    },
    {
      code: '"use server";\nexport async function save() { const ok = check(); await requireStaff(); }',
      options: guarded,
      errors: [{ messageId: "missingGuard" }],
    },
    {
      code: '"use server";\nexport async function save() { await requireAdmin(); }',
      options: guarded,
      errors: [{ messageId: "missingGuard" }],
    },
    {
      code: '"use server";\nexport const save = async () => 1;',
      options: guarded,
      errors: [{ messageId: "missingGuard" }],
    },
    {
      code: '"use server";\nasync function save() { await requireStaff(); }\nexport { save };',
      options: guarded,
      errors: [{ messageId: "exportWhereDeclared" }],
    },
    {
      code: '"use server";\nexport default async function save() { await requireStaff(); }',
      options: guarded,
      errors: [{ messageId: "exportWhereDeclared" }],
    },
    {
      code: '"use server";\nexport const limit = 10;',
      options: guarded,
      errors: [{ messageId: "exportWhereDeclared" }],
    },
    {
      code: 'export function Page() { const save = async () => { "use server"; return 1; }; return save; }',
      options: guarded,
      errors: [{ messageId: "missingGuard" }],
    },
  ],
});
