import { ruleTester } from "../shared/rule-tester.ts";
import { electronNoRemoteModule } from "./electron-no-remote-module.ts";

ruleTester.run("electron-no-remote-module", electronNoRemoteModule, {
  valid: [
    'import { ipcRenderer } from "electron";',
    'import { BrowserWindow } from "electron/main";',
    'import remote from "./remote";',
    'import { remote } from "electron-remote-helper";',
    'const { app } = require("electron");',
    "remote.getCurrentWindow();",
    'import electron from "electron"; electron.app.quit();',
    "const settings = { remote: true }; settings.remote;",
    'import { remote } from "./remote"; remote.getCurrentWindow();',
    'const { remote } = loadSettings("electron");',
  ],
  invalid: [
    { code: 'import { remote } from "electron";', errors: [{ messageId: "remote" }] },
    { code: 'import { app, remote as r } from "electron";', errors: [{ messageId: "remote" }] },
    { code: 'import { "remote" as r } from "electron";', errors: [{ messageId: "remote" }] },
    { code: 'import * as remote from "@electron/remote";', errors: [{ messageId: "remote" }] },
    {
      code: 'import { initialize } from "@electron/remote/main";',
      errors: [{ messageId: "remote" }],
    },
    { code: 'require("@electron/remote/main").initialize();', errors: [{ messageId: "remote" }] },
    { code: 'const { remote } = require("electron");', errors: [{ messageId: "remote" }] },
    { code: 'require("electron").remote.getCurrentWindow();', errors: [{ messageId: "remote" }] },
    {
      code: 'const electron = require("electron"); electron.remote.getCurrentWindow();',
      errors: [{ messageId: "remote" }],
    },
    {
      code: 'import * as electron from "electron"; electron.remote.getCurrentWindow();',
      errors: [{ messageId: "remote" }],
    },
    {
      code: 'import electron from "electron"; const { remote } = electron;',
      errors: [{ messageId: "remote" }],
    },
    { code: 'await import("@electron/remote");', errors: [{ messageId: "remote" }] },
    { code: 'export { remote } from "electron";', errors: [{ messageId: "remote" }] },
    { code: 'export * from "@electron/remote";', errors: [{ messageId: "remote" }] },
  ],
});
