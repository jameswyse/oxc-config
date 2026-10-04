import { ruleTester } from "../shared/rule-tester.ts";
import { electronNoRawIpcRendererExposure } from "./electron-no-raw-ipc-renderer-exposure.ts";

const imports = 'import { contextBridge, ipcRenderer } from "electron";';

ruleTester.run("electron-no-raw-ipc-renderer-exposure", electronNoRawIpcRendererExposure, {
  valid: [
    `${imports} contextBridge.exposeInMainWorld("api", { load: () => ipcRenderer.invoke("settings:load"), save: (value: Settings) => ipcRenderer.invoke("settings:save", value) });`,
    `${imports} contextBridge.exposeInMainWorld("api", { onSync: (callback: (event: SyncEvent) => void) => { const listener = (_event: IpcRendererEvent, payload: SyncEvent) => callback(payload); ipcRenderer.on("sync:event", listener); return () => ipcRenderer.removeListener("sync:event", listener); } });`,
    `${imports} const api = { ping: () => ipcRenderer.invoke("ping") }; contextBridge.exposeInMainWorld("api", api);`,
    `${imports} contextBridge.exposeInMainWorld("api", { ipcRenderer: () => ipcRenderer.invoke("ping") });`,
    `${imports} contextBridge.exposeInMainWorld("versions", { node: process.versions.node });`,
    `${imports} function send(channel: string) { ipcRenderer.send(channel); }`,
    `${imports} function expose(channel: string) { contextBridge.exposeInMainWorld("api", { ping: () => ipcRenderer.invoke(channel) }); }`,
    `${imports} exposeInMainWorld("api", ipcRenderer);`,
  ],
  invalid: [
    {
      code: `${imports} contextBridge.exposeInMainWorld("ipc", ipcRenderer);`,
      errors: [{ messageId: "exposed" }],
    },
    {
      code: `${imports} contextBridge.exposeInMainWorld("api", { ipc: ipcRenderer });`,
      errors: [{ messageId: "exposed" }],
    },
    {
      code: `${imports} contextBridge.exposeInMainWorld("api", { ipcRenderer });`,
      errors: [{ messageId: "exposed" }],
    },
    {
      code: `${imports} contextBridge.exposeInMainWorld("api", { send: ipcRenderer.send });`,
      errors: [{ messageId: "exposed" }],
    },
    {
      code: `${imports} contextBridge.exposeInMainWorld("api", { invoke: ipcRenderer.invoke.bind(ipcRenderer) });`,
      errors: [{ messageId: "exposed" }, { messageId: "exposed" }],
    },
    {
      code: `${imports} contextBridge.exposeInMainWorld("api", { nested: { send: ipcRenderer.send } });`,
      errors: [{ messageId: "exposed" }],
    },
    {
      code: `${imports} contextBridge.exposeInMainWorld("api", { ...ipcRenderer });`,
      errors: [{ messageId: "exposed" }],
    },
    {
      code: `${imports} contextBridge.exposeInMainWorld("api", { call: (method: string) => ipcRenderer[method]("ping") });`,
      errors: [{ messageId: "exposed" }],
    },
    {
      code: `${imports} contextBridge.exposeInMainWorld("api", { send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args) });`,
      errors: [{ messageId: "channel" }],
    },
    {
      code: `${imports} contextBridge.exposeInMainWorld("api", { invoke: (...args: unknown[]) => ipcRenderer.invoke(...args) });`,
      errors: [{ messageId: "channel" }],
    },
    {
      code: `${imports} contextBridge.exposeInMainWorld("api", { on: (channel: string, callback: Listener) => ipcRenderer.on(channel, callback) });`,
      errors: [{ messageId: "channel" }, { messageId: "listener", data: { method: "on" } }],
    },
    {
      code: `${imports} contextBridge.exposeInMainWorld("api", { onUpdate: (callback: Listener) => ipcRenderer.on("update", callback) });`,
      errors: [{ messageId: "listener", data: { method: "on" } }],
    },
    {
      code: `${imports} const api = { send: ipcRenderer.send }; contextBridge.exposeInMainWorld("api", api);`,
      errors: [{ messageId: "exposed" }],
    },
    {
      code: `${imports} contextBridge.exposeInIsolatedWorld(1004, "api", ipcRenderer);`,
      errors: [{ messageId: "exposed" }],
    },
    {
      code: 'import { contextBridge as bridge, ipcRenderer as ipc } from "electron"; bridge.exposeInMainWorld("api", { ipc });',
      errors: [{ messageId: "exposed" }],
    },
    {
      code: 'import electron from "electron"; electron.contextBridge.exposeInMainWorld("api", { ipc: electron.ipcRenderer });',
      errors: [{ messageId: "exposed" }],
    },
    {
      code: 'const { contextBridge, ipcRenderer } = require("electron"); contextBridge.exposeInMainWorld("api", { send: (channel) => ipcRenderer.send(channel) });',
      errors: [{ messageId: "channel" }],
    },
  ],
});
