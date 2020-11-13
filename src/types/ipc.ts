/* eslint-disable @typescript-eslint/no-empty-interface */
import { ApplicationConfig, UserPreferences } from "./config";
import { IpcMainInvokeEvent, IpcRendererEvent } from "electron";
import ipcRenderer = Electron.Renderer.ipcRenderer;

/*
Requests from renderer to main
  can be invoked with ipcRenderer.invoke
  handler can be set with ipcMain.handle (or handleOnce)
  return value of handler would be passed to remote caller

Events from main to single renderer
  must be sent using BrowserWindow.webContents object
  can be handled with ipcRenderer object
  event.returnValue would be passed to remote caller

Events from renderer
  can be send using ipcRenderer.send (or sendSyc)
  can be handled with ipcMain.on (or once)
  event.returnValue would be passed to remote caller

*/
export const CHANNELS = Object.freeze({
  // Metadata
  GET_CONFIG: "get_config",
  UPDATE_USER_PREFERENCES: "update_user_preferences",
  GET_USER_DATA: "get_user_data",
});

declare type UserData = unknown;

export interface IpcMainHandle {
  // Metadata
  (
    channel: typeof CHANNELS.GET_CONFIG,
    listener: (e: IpcMainInvokeEvent) => Promise<ApplicationConfig> | ApplicationConfig
  ): void;
  (
    channel: typeof CHANNELS.UPDATE_USER_PREFERENCES,
    listener: (e: IpcMainInvokeEvent, config: UserPreferences) => Promise<void> | void
  ): void;
  (
    channel: typeof CHANNELS.GET_USER_DATA,
    listener: (e: IpcMainInvokeEvent) => Promise<UserData> | UserData
  ): void;

}

export interface IpcRendererInvoke {
  // Metadata
  (channel: typeof CHANNELS.GET_CONFIG): Promise<ApplicationConfig>;
  (
    channel: typeof CHANNELS.UPDATE_USER_PREFERENCES,
    config: UserPreferences
  ): Promise<void>;
  (channel: typeof CHANNELS.GET_USER_DATA): Promise<UserData>;
}

// Events emitted by main process
export interface IpcRendererOn {}
export interface WebContentsSend {}

// Events emitted by renderer processes
export interface ipcRendererSend {}
export interface ipcMainOn {}

// Declarations for renderer global augment
export interface InvokeMain {
  // Metadata
  getConfig(): Promise<ApplicationConfig>;
  updateUserPreferences(config: UserPreferences): Promise<void>;
  getUSerData(): Promise<UserData>;
}

export interface IpcClient {
  CHANNELS: typeof CHANNELS;
  invoke: InvokeMain;
  on: IpcRendererOn,
  once: IpcRendererOn,
  off: typeof ipcRenderer.off,
}
