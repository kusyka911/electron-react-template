import { ipcRenderer } from "electron";
import {CHANNELS, InvokeMain, IpcClient} from "@/types/ipc";

const invoke = ipcRenderer.invoke.bind(ipcRenderer);

const invokeMain: InvokeMain = {
  // Metadata
  getConfig: () => invoke(CHANNELS.GET_CONFIG),
  updateUserPreferences: (config) =>
    invoke(CHANNELS.UPDATE_USER_PREFERENCES, config),
  getUSerData: () => invoke(CHANNELS.GET_USER_DATA),
};

export const ipcClient: IpcClient = {
  CHANNELS,
  invoke: invokeMain,
  on: ipcRenderer.on.bind(ipcRenderer),
  once: ipcRenderer.once.bind(ipcRenderer),
  off: ipcRenderer.off.bind(ipcRenderer),
}
