import { ruleTester } from "../shared/rule-tester.ts";
import { noPassThroughFunction } from "./no-pass-through-function.ts";

ruleTester.run("no-pass-through-function", noPassThroughFunction, {
  valid: [
    "function parseProduct(value: unknown) { return productSchema.parse(value); }",
    "const save = (user: User) => repository.save(user);",
    "class Notifier { notify(event: Event) { this.send(event); } }",
    "function isJsonArray(value: JsonValue): value is JsonValue[] { return isArray(value); }",
    "const handleExit = () => { exit(); };",
    "function format(value: number) { return render(value, 'short'); }",
    "function swap(first: string, second: string) { return join(second, first); }",
    "function partial(first: string, second: string) { return join(first); }",
    "function log(value: string) { record(value); return value; }",
    "values.map((value) => transform(value));",
    "button.addEventListener('click', function (event) { handle(event); });",
    "const handler = { run(value: string) { return execute(value); } };",
    "function* items(source: Source) { yield* read(source); }",
    "function load(id: string) { return fetch?.(id); }",
    "function wrap({ id }: Props) { return render(id); }",
    "const handleKeyDown = useEffectEvent((event: KeyboardEvent) => close(event)); function forward(event: KeyboardEvent) { handleKeyDown(event); }",
  ],
  invalid: [
    {
      code: "export function withQuoteProfile(context: Context, profile: Profile) { return applyQuoteProfile(context, profile); }",
      errors: [
        {
          messageId: "passThrough",
          data: { name: "withQuoteProfile", callee: "applyQuoteProfile" },
        },
      ],
    },
    {
      code: "const handleDateChange = (date: Date) => { onDateChange(date); };",
      errors: [
        { messageId: "passThrough", data: { name: "handleDateChange", callee: "onDateChange" } },
      ],
    },
    {
      code: "const handleError = (error: Error): void => reject(error);",
      errors: [{ messageId: "passThrough", data: { name: "handleError", callee: "reject" } }],
    },
    {
      code: "const load = async function (id: string) { return await fetchRecord(id); };",
      errors: [{ messageId: "passThrough", data: { name: "load", callee: "fetchRecord" } }],
    },
    {
      code: "function forward(...args: string[]) { return target(...args); }",
      errors: [{ messageId: "passThrough", data: { name: "forward", callee: "target" } }],
    },
    {
      code: "class Panel { request(panel: string) { return setPanel(panel); } }",
      errors: [{ messageId: "passThrough", data: { name: "request", callee: "setPanel" } }],
    },
    {
      code: "class Panel { request = (panel: string) => setPanel(panel); }",
      errors: [{ messageId: "passThrough", data: { name: "request", callee: "setPanel" } }],
    },
  ],
});
