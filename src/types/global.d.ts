declare global {
  declare const PLATFORM: "web" | "desktop" | "ios" | "android";
  namespace process {
    namespace env {
      declare const NODE_ENV: string;
      declare const DEBUG: boolean;
    }
  }

  declare const APP_NAME: string;
  declare const APP_VERSION: string;
}
