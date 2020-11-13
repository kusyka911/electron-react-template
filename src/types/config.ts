export type WindowConfig = {
  autoHideMenuBar?: boolean;
  maximized?: boolean;
  fullscreen?: boolean;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
};

export type UserPreferences = any;

export interface ApplicationConfig {
  // TODO: database config
  mainWindow?: Partial<WindowConfig>;
  storageProfile?: string;
  userPreferences?: UserPreferences;
  debug: {
    logs: boolean;
    standalone: boolean;
    enableConsole: boolean;
    openConsole: boolean;
    displaySas: boolean;
  };
}
