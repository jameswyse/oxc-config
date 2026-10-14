import { ruleTester } from "../shared/rule-tester.ts";
import { noGetPasswordForm } from "./no-get-password-form.ts";

const error = { messageId: "get" };

function tsx(code: string) {
  return { code, filename: "form.tsx" };
}

ruleTester.run("no-get-password-form", noGetPasswordForm, {
  valid: [
    tsx(
      'export const SignIn = () => <form method="post" onSubmit={submit}><input name="password" type="password" /></form>;',
    ),
    tsx('export const SignIn = () => <form method="POST"><input type="password" /></form>;'),
    tsx('export const SignIn = () => <form action={signIn}><input type="password" /></form>;'),
    tsx('export const Search = () => <form action="/search"><input name="q" /></form>;'),
    tsx(
      'export const SignIn = (props: FormProps) => <form {...props}><input type="password" /></form>;',
    ),
    tsx('export const SignIn = () => <form method={method}><input type="password" /></form>;'),
    tsx('export const Field = () => <input type="password" />;'),
    tsx(
      'export const SignIn = () => <form method="post"><input type="password" /><button type="button" formMethod="get">Show</button></form>;',
    ),
    tsx(
      'export const SignIn = () => <><form id="search" method="get"><input form="login" type="password" /></form><form id="login" method="post" /></>;',
    ),
    tsx(
      'export const Edit = () => <dialog><form method="dialog"><input type="password" /><button>Close</button></form></dialog>;',
    ),
    tsx(
      'export const SignIn = () => <form id="" method="post"><input name="password" type="password" /><button form="" formMethod="get">Send</button></form>;',
    ),
  ],
  invalid: [
    {
      ...tsx(
        'export const SignIn = () => <form action={"/login"} method={"get"}><input type={"password"} /></form>;',
      ),
      errors: [error],
    },
    {
      ...tsx(
        'export const SignIn = () => <form method="post"><input type="password" /><input type="submit" formMethod="get" /></form>;',
      ),
      errors: [error],
    },
    {
      ...tsx(
        'export const SignIn = () => <form method="post"><input type="password" /><button formMethod="get">Sign in</button></form>;',
      ),
      errors: [error],
    },
    {
      ...tsx(
        'export const SignIn = () => <form onSubmit={submit}><input name="password" type="password" /></form>;',
      ),
      errors: [error],
    },
    {
      ...tsx(
        'export const Reset = () => <form action="/reset"><label>Password<input type="password" /></label></form>;',
      ),
      errors: [error],
    },
    {
      ...tsx(
        'export const Code = () => <form method="get">{step === "code" && <input autoComplete="one-time-code" />}</form>;',
      ),
      errors: [error],
    },
    {
      ...tsx(
        'export const Change = () => <form onSubmit={submit}>{fields.map((field) => <input key={field} type="password" />)}</form>;',
      ),
      errors: [error],
    },
    {
      ...tsx(
        'export const SignIn = () => <><form id="login" method="get" /><input form="login" name="password" type="password" /></>;',
      ),
      errors: [error],
    },
    {
      ...tsx(
        'export const Code = () => <form><input name="code" autoComplete="section-login one-time-code" /></form>;',
      ),
      errors: [error],
    },
    {
      ...tsx('export const SignIn = () => <form method=""><input type="password" /></form>;'),
      errors: [error],
    },
    {
      ...tsx(
        'export const SignIn = () => <form method="post"><input type="password" /><button formMethod="">Sign in</button></form>;',
      ),
      errors: [error],
    },
    {
      ...tsx('export const SignIn = () => <form method=" post "><input type="password" /></form>;'),
      errors: [error],
    },
    {
      ...tsx(
        'export const SignIn = () => <form><input form={undefined} name="password" type="password" /></form>;',
      ),
      errors: [error],
    },
    {
      ...tsx(
        'export const Other = () => <form id="login" method="post" />; export const SignIn = () => <><form id="login" /><input form="login" name="password" type="password" /></>;',
      ),
      errors: [error],
    },
  ],
});
