import ipcMain = Electron.Main.ipcMain;
import {CHANNELS, IpcMainHandle} from "@/types/ipc";
import {getConfig, setUserPreferences,} from "@/electron/main/config";
import {UserPreferences} from "@/types/config";
import {IpcMainInvokeEvent} from "electron";

const handle = ipcMain.handle.bind(ipcMain) as IpcMainHandle;

handle(CHANNELS.GET_CONFIG,() => getConfig());

handle(CHANNELS.UPDATE_USER_PREFERENCES,
  (e: IpcMainInvokeEvent, data: UserPreferences) => setUserPreferences(data));

handle(CHANNELS.GET_USER_DATA, () => ({}));
