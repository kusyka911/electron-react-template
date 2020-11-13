import path from "path";
import {
  app,
  protocol,
  BrowserWindow,
  screen,
  Rectangle,
  BrowserWindowConstructorOptions
} from "electron";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";
import _ from "lodash";
import {
  createFileProtocol,
  instalProtocolHandlers,
  handleUrl
} from "./protocols";
import { getConfig, setMainWindowConfig } from "./config";
// Import all ipc handlers;
import("./ipc");

declare const APP_NAME: string;

// TODO: Replace with value from define-plugin
const isDevelopment = Boolean(process.env.WDS_URL);
const isTest = Boolean(process.env.IS_TEST);

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const MIN_WIDTH = 680;
const MIN_HEIGHT = 550;
const BOUNDS_BUFFER = 100;

function isVisible(window: Rectangle, bounds: Rectangle) {
  const boundsX = _.get(bounds, "x") || 0;
  const boundsY = _.get(bounds, "y") || 0;
  const boundsWidth = _.get(bounds, "width") || DEFAULT_WIDTH;
  const boundsHeight = _.get(bounds, "height") || DEFAULT_HEIGHT;

  // requiring BOUNDS_BUFFER pixels on the left or right side
  const rightSideClearOfLeftBound =
    window.x + window.width >= boundsX + BOUNDS_BUFFER;
  const leftSideClearOfRightBound =
    window.x <= boundsX + boundsWidth - BOUNDS_BUFFER;

  // top can't be offscreen, and must show at least BOUNDS_BUFFER pixels at bottom
  const topClearOfUpperBound = window.y >= boundsY;
  const topClearOfLowerBound =
    window.y <= boundsY + boundsHeight - BOUNDS_BUFFER;

  return (
    rightSideClearOfLeftBound &&
    leftSideClearOfRightBound &&
    topClearOfUpperBound &&
    topClearOfLowerBound
  );
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow | null;
let windowIcon: string;

// switch (process.platform) {
//   // TODO: check png icon on windows
//   case "win32":
//     windowIcon = path.join(__static, "icons/win/icon.ico");
//     break;
//   case "darwin":
//   case "linux":
//   default:
//     windowIcon = path.join(__static, "icons/png/512x512.png");
// }

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true } }
]);

function handleCommonWindowEvents(window: BrowserWindow) {
  window.webContents.on("will-navigate", handleUrl);
  window.webContents.on("new-window", handleUrl);
  window.webContents.on("preload-error", (event, preloadPath, error) => {
    // logger.error(`Preload error in ${preloadPath}: `, error.message);
    console.error(`Preload error in ${preloadPath}: `, error.message);
  });
}

const captureMainWindowStats = _.debounce(() => {
  if (!mainWindow) return;

  const size = mainWindow.getSize();
  const position = mainWindow.getPosition();

  setMainWindowConfig({
    maximized: mainWindow.isMaximized(),
    autoHideMenuBar: mainWindow.autoHideMenuBar,
    fullscreen: mainWindow.isFullScreen(),
    width: size[0],
    height: size[1],
    x: position[0],
    y: position[1]
  });
}, 500);

function createMainWindow() {
  const config = getConfig();
  const windowConfig = config.mainWindow || {};
  const debugConfig = config.debug || {};
  // merge saved mainWindow config
  const windowOptions = _.merge(
    {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      title: `${APP_NAME}${config.storageProfile ? `-${config.storageProfile}` : ""}`,
      icon: windowIcon,
      autoHideMenuBar: false,
      webPreferences: {
        // devTools: !!debugConfig.enableConsole,
        worldSafeExecuteJavaScript: true,
        contextIsolation: false,
        devTools: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        nativeWindowOpen: true,
        webSecurity: true,
        preload: path.resolve(__dirname, "preload/main.js")
      }
    },
    _.pick(windowConfig, ["autoHideMenuBar", "width", "height", "x", "y"])
  ) as BrowserWindowConstructorOptions;
  console.debug(`preload path: ${path.resolve(__dirname, "preload/main.js")}`);

  if (!_.isNumber(windowOptions.width) || windowOptions.width < MIN_WIDTH) {
    windowOptions.width = DEFAULT_WIDTH;
  }
  if (!_.isNumber(windowOptions.height) || windowOptions.height < MIN_HEIGHT) {
    windowOptions.height = DEFAULT_HEIGHT;
  }
  if (!_.isBoolean(windowOptions.autoHideMenuBar)) {
    delete windowOptions.autoHideMenuBar;
  }

  // Reset window position if it's not visible
  const visibleOnAnyScreen = _.some(screen.getAllDisplays(), display => {
    if (!_.isNumber(windowOptions.x) || !_.isNumber(windowOptions.y)) {
      return false;
    }

    return isVisible(windowOptions as Rectangle, _.get(display, "bounds"));
  });

  if (!visibleOnAnyScreen) {
    delete windowOptions.x;
    delete windowOptions.y;
  }

  // Create the browser window.
  mainWindow = new BrowserWindow(windowOptions);

  if (windowConfig.maximized) mainWindow.maximize();
  if (mainWindow.fullScreen) mainWindow.setFullScreen(true);

  mainWindow.on("resize", captureMainWindowStats);
  mainWindow.on("move", captureMainWindowStats);

  if (!app.isPackaged && process.env.WDS_URL) {
    // Load the url of the dev server if in development mode
    mainWindow.loadURL(process.env.WDS_URL);
  } else {
    // Load the index.html when not in development
    mainWindow.loadURL("app://./ui/index.html");
  }

  if (!isTest && debugConfig.openConsole) mainWindow.webContents.openDevTools();
  mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  handleCommonWindowEvents(mainWindow);
}

/*
  Application events
*/
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    // TODO: tray background running for other platforms
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createMainWindow();
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  createFileProtocol("app");

  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS_DEVTOOLS);
    } catch (e) {
      // logger.error("Vue Devtools failed to install:", e.toString());
      console.error("Vue Devtools failed to install:", e.toString());
    }
  }
  instalProtocolHandlers(protocol, isDevelopment);
  createMainWindow();
});

app.on("web-contents-created", (createEvent, contents) => {
  contents.on("will-attach-webview", attachEvent => {
    attachEvent.preventDefault();
  });
  contents.on("new-window", newEvent => {
    newEvent.preventDefault();
  });
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === "win32") {
    process.on("message", data => {
      if (data === "graceful-exit") {
        app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      app.quit();
    });
  }
}
