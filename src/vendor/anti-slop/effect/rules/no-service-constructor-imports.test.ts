// Adapted from dmmulroy/anti-slop
import { ruleTester } from "../../../../shared/rule-tester.ts";
import { noServiceConstructorImports } from "./no-service-constructor-imports.ts";

ruleTester.run("no-service-constructor-imports", noServiceConstructorImports, {
  valid: [
    {
      filename: "src/issue-service.test.ts",
      code: 'import { makeIssueService } from "../../../../rules/issue-service.ts";',
    },
    {
      filename: "src/issue-service.spec.tsx",
      code: 'import { makeIssueService } from "../../../../issue-service.ts";',
    },
    {
      filename: "src/runtime.ts",
      code: 'import { makeExecutionMemo } from "alchemy/Runtime/ExecutionMemo";',
    },
    {
      filename: "src/runtime.ts",
      code: 'import { issueServiceLayer } from "../../../../rules/issue-service.ts";\nWorkspaceName.make("name");',
    },
    {
      filename: "src/runtime.ts",
      code: 'import { makeissueService } from "../../../../rules/issue-service.ts";',
    },
  ],
  invalid: [
    {
      filename: "src/runtime.ts",
      code: 'import { makeIssueService } from "../../../../rules/issue-service.ts";',
      errors: [{ messageId: "serviceConstructorImport", data: { name: "makeIssueService" } }],
      output: null,
    },
    {
      filename: "src/runtime.ts",
      code: 'import { makeIssueService as createIssueService } from "../../../../issue-service.ts";',
      errors: [{ messageId: "serviceConstructorImport", data: { name: "makeIssueService" } }],
      output: null,
    },
  ],
});
