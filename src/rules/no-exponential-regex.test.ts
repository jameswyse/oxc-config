import { ruleTester } from "../shared/rule-tester.ts";
import { noExponentialRegex } from "./no-exponential-regex.ts";

function error(quantifier: string) {
  return { messageId: "exponential", data: { quantifier } };
}

ruleTester.run("no-exponential-regex", noExponentialRegex, {
  valid: [
    String.raw`const pattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;`,
    String.raw`const pattern = /^(\d+\.)*\d+$/;`,
    String.raw`const pattern = /(a+b)*/;`,
    String.raw`const pattern = /(a?)+/;`,
    String.raw`const pattern = /(a+){2}/;`,
    String.raw`const pattern = /(a|ab)*c/;`,
    String.raw`const pattern = /([a-z]|-)+/;`,
    String.raw`const pattern = /(.|\n)*/;`,
    String.raw`const pattern = /(?:^.+$\n?)*/m;`,
    String.raw`const pattern = /(\b\w+\b\s*)*/;`,
    String.raw`const pattern = /(a|A)+/;`,
    String.raw`const pattern = /(\p{L}|\d)+/u;`,
    String.raw`const pattern = /([\q{ab}a]|a)+/v;`,
    String.raw`const pattern = /\s*\s*$/;`,
    String.raw`const pattern = /^([^"]|\\")*$/;`,
    String.raw`const pattern = new RegExp("^(?:,\\s*\\w+)*$");`,
    String.raw`const pattern = new RegExp(input);`,
    String.raw`const pattern = new Matcher("(a+)+");`,
    String.raw`const pattern = new RegExp("(");`,
    String.raw`const pattern = /(a+)+/;`,
    String.raw`const pattern = /(?:[^\s"]+|"[^"]*")+/g;`,
    String.raw`const pattern = /^(\s*\w+)*/;`,
    String.raw`const pattern = /(?=(a+)+)b/;`,
    String.raw`const pattern = /(?<=(a+)+b)c/;`,
    String.raw`const pattern = /^([^a]|A)+!$/i;`,
    String.raw`const pattern = /([^a-z]|[a-z])+$/i;`,
    String.raw`const pattern = /^(ab|ba)+$/;`,
    String.raw`const pattern = /^(?:a{1000}|b)+$/;`,
  ],
  invalid: [
    { code: String.raw`const pattern = /^(a+)+$/;`, errors: [error("(a+)+")] },
    { code: String.raw`const pattern = /^(a*)*$/;`, errors: [error("(a*)*")] },
    { code: String.raw`const pattern = /^(\w+\s?)*$/;`, errors: [error(String.raw`(\w+\s?)*`)] },
    {
      code: String.raw`const pattern = /^(?:\s*\w+)*$/;`,
      errors: [error(String.raw`(?:\s*\w+)*`)],
    },
    { code: String.raw`const pattern = /(a{1,3})+$/;`, errors: [error("(a{1,3})+")] },
    { code: String.raw`const pattern = /(a|b+)+$/;`, errors: [error("(a|b+)+")] },
    { code: String.raw`const pattern = /((a+)?)*$/;`, errors: [error("((a+)?)*")] },
    {
      code: String.raw`const pattern = /(?:[a-z]+[0-9]*){2,}$/;`,
      errors: [error("(?:[a-z]+[0-9]*){2,}")],
    },
    { code: String.raw`const pattern = /(a+)+?$/;`, errors: [error("(a+)+?")] },
    { code: String.raw`const pattern = /^(.|\s)*$/;`, errors: [error(String.raw`(.|\s)*`)] },
    { code: String.raw`const pattern = /(.|\n)*x/s;`, errors: [error(String.raw`(.|\n)*`)] },
    { code: String.raw`const pattern = /^(\w|\d)+$/;`, errors: [error(String.raw`(\w|\d)+`)] },
    { code: String.raw`const pattern = /^(a|a)*$/;`, errors: [error("(a|a)*")] },
    { code: String.raw`const pattern = /^(ab|ab)*$/;`, errors: [error("(ab|ab)*")] },
    { code: String.raw`const pattern = /^(a|A)+$/i;`, errors: [error("(a|A)+")] },
    {
      code: String.raw`const pattern = /"(?:[^"\\]+|\\.)*"/;`,
      errors: [error(String.raw`(?:[^"\\]+|\\.)*`)],
    },
    {
      code: String.raw`const pattern = /^([a-f]|[0-9a-z])+$/;`,
      errors: [error("([a-f]|[0-9a-z])+")],
    },
    { code: String.raw`const pattern = new RegExp("^(a+)+$");`, errors: [error("(a+)+")] },
    { code: String.raw`const pattern = /^(a|aa)+$/;`, errors: [error("(a|aa)+")] },
    { code: String.raw`const pattern = /(?<=b(a+)+)c/;`, errors: [error("(a+)+")] },
    { code: String.raw`const pattern = /^(ab|a|ba)+$/;`, errors: [error("(ab|a|ba)+")] },
    {
      code: String.raw`const pattern = /^(?:\d|[0-9]{2})+$/;`,
      errors: [error(String.raw`(?:\d|[0-9]{2})+`)],
    },
    {
      code: String.raw`const group = "(a+)+$"; const pattern = new RegExp(group, "u");`,
      errors: [error("(a+)+")],
    },
    { code: String.raw`const pattern = new RegExp("^(a+)" + "+$");`, errors: [error("(a+)+")] },
    {
      code: "const pattern = new RegExp(String.raw`^(\\w+\\s?)*$`);",
      errors: [error(String.raw`(\w+\s?)*`)],
    },
    {
      code: 'const pattern = RegExp(`^(\\\\w+\\\\s?)*$`, "u");',
      errors: [error(String.raw`(\w+\s?)*`)],
    },
    {
      code: String.raw`const pattern = new RegExp("^(.|\\s)*$", flags);`,
      errors: [error(String.raw`(.|\s)*`)],
    },
  ],
});
