import { ruleTester } from "../shared/rule-tester.ts";
import { noDynamicShellCommand } from "./no-dynamic-shell-command.ts";

const command = { messageId: "command" };

const shell = { messageId: "shell" };

ruleTester.run("no-dynamic-shell-command", noDynamicShellCommand, {
  valid: [
    'import { exec } from "node:child_process";',
    'import { exec } from "node:child_process"; exec("git status");',
    'import { execSync } from "child_process"; execSync(`git rev-parse HEAD`);',
    'import { execSync } from "child_process"; const status = "git status"; execSync(status);',
    'import { execFile } from "node:child_process"; execFile("git", ["log", ref]);',
    'import { execFileSync } from "node:child_process"; execFileSync(binary, args, { cwd });',
    'import { spawn } from "node:child_process"; spawn(process.execPath, [script], { stdio: "inherit" });',
    'import { spawn } from "node:child_process"; spawn("pnpm", ["run", "build"], { shell: true });',
    'import { spawn } from "node:child_process"; spawn(binary, args, { shell: false });',
    'import { spawn } from "node:child_process"; spawn(binary, args, options);',
    'import { spawn } from "node:child_process"; const options = { shell: true }; options.shell = false; spawn(command, [], options);',
    'import { spawn } from "node:child_process"; const options = { shell: true }; const alias = options; alias.shell = false; spawn(command, [], options);',
    'import { spawn } from "node:child_process"; const options = { shell: true }; ({ shell: options.shell } = { shell: false }); spawn(command, [], options);',
    'import { spawn } from "node:child_process"; const args = ["log"]; if (args.length > 0) { spawn("git", args, { shell: true }); }',
    'import { spawn } from "node:child_process"; const options = { shell: true }; spawn("pnpm", ["build"], options);',
    'import { spawn } from "node:child_process"; const args = ["run", "build"]; spawn("pnpm", args, { shell: true });',
    'import { spawn } from "node:child_process"; spawn(command, args, { shell: "" });',
    'import { spawn } from "node:child_process"; const shell = false; spawn(command, args, { shell });',
    'import { spawn } from "node:child_process"; const args = ["log"] as const; spawn("git", args, { shell: true });',
    'import { execSync } from "node:child_process"; execSync(String.raw`git log --format=%H`);',
    "import { exec } from './shell'; exec(command);",
    "const exec = (value: string) => value; exec(command);",
    'import { promisify } from "node:util"; import { execFile } from "node:child_process"; promisify(execFile)(process.execPath, [fixture]);',
    "import { exec } from 'node:child_process'; function run(exec: (value: string) => void) { exec(command); }",
  ],
  invalid: [
    {
      code: 'import { exec } from "node:child_process"; exec(`git checkout ${branch}`);',
      errors: [{ ...command, data: { name: "exec" } }],
    },
    {
      code: 'import { execSync } from "child_process"; execSync("rm -rf " + directory);',
      errors: [{ ...command, data: { name: "execSync" } }],
    },
    {
      code: 'import * as childProcess from "node:child_process"; childProcess.exec(command);',
      errors: [command],
    },
    { code: 'import cp from "child_process"; cp.execSync(command);', errors: [command] },
    {
      code: 'import { exec as run } from "node:child_process"; run(command, callback);',
      errors: [command],
    },
    { code: 'const { exec } = require("child_process"); exec(command);', errors: [command] },
    { code: 'require("node:child_process").execSync(command);', errors: [command] },
    {
      code: 'import { exec } from "node:child_process"; import { promisify } from "node:util"; const run = promisify(exec); await run(command);',
      errors: [command],
    },
    {
      code: 'import { exec } from "node:child_process"; import util from "node:util"; await util.promisify(exec)(command);',
      errors: [command],
    },
    {
      code: 'import { exec } from "node:child_process"; let status = "git status"; status = input; exec(status);',
      errors: [command],
    },
    {
      code: 'import { spawn } from "node:child_process"; spawn(command, { shell: true });',
      errors: [{ ...shell, data: { name: "spawn" } }],
    },
    {
      code: 'import { spawnSync } from "node:child_process"; spawnSync("git", ["checkout", branch], { shell: true });',
      errors: [{ ...shell, data: { name: "spawnSync" } }],
    },
    {
      code: 'import { execFile } from "node:child_process"; execFile("git", args, { shell: true }, callback);',
      errors: [{ ...shell, data: { name: "execFile" } }],
    },
    {
      code: 'import { execFileSync } from "node:child_process"; execFileSync(`${bin}/tool`, [], { shell: "/bin/bash" });',
      errors: [{ ...shell, data: { name: "execFileSync" } }],
    },
    {
      code: 'import { spawn } from "node:child_process"; spawn("git", ["log", ...refs], { shell: true });',
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; const args = ["log"]; args.push(input); spawn("git", args, { shell: true });',
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; const args = ["log"]; args.push(input); const alias = args; spawn("git", alias, { shell: true });',
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; const args = ["log"]; const alias = args; alias.push(input); spawn("git", args, { shell: true });',
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; const args = ["log"]; addRefs(args); spawn("git", args, { shell: true });',
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; const options = { shell: true }; let alias = options; alias = { shell: false }; alias.shell = false; spawn(command, [], options);',
      errors: [shell],
    },
    {
      code: `import { spawn } from "node:child_process"; const a0 = { shell: true }; ${Array.from({ length: 3000 }, (_, index) => `const a${index + 1} = a${index};`).join(" ")} spawn(command, [], a0);`,
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; const options = { shell: true }; spawn(command, [], options as SpawnOptions);',
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; const options = { shell: true, cwd: "." }; log(options.cwd); spawn(command, [], options!);',
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; const base = { shell: true }; const options = base; log(options); spawn(command, [], options);',
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; const args = ["log"]; [args[0]] = [input]; spawn("git", args, { shell: true });',
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; const args = ["log"]; for (args[0] of inputs) { spawn("git", args, { shell: true }); }',
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; const args = ["log"]; args[0] = input; spawn("git", args, { shell: true });',
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; const options = { shell: true }; spawn(command, [], options);',
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; const shell = "/bin/bash"; spawn(command, [], { shell });',
      errors: [shell],
    },
    {
      code: 'import { spawn } from "node:child_process"; spawn("git", [input], { shell: `/bin/sh` });',
      errors: [shell],
    },
    {
      code: 'import { exec } from "node:child_process"; import { promisify } from "node:util"; const run = promisify(exec); const alias = run; await alias(command);',
      errors: [command],
    },
  ],
});
