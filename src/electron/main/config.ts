import fs from "fs";
import { resolve } from "path";
import { app } from "electron";
import { Buffer } from "buffer";
import _ from "lodash";
import {
  ApplicationConfig,
  WindowConfig,
  UserPreferences
} from "@/types/config";

// Must be defined at build-time
declare const DEFAULT_CONFIG: ApplicationConfig;
declare const STORAGE_PROFILE: string | undefined;
declare const APP_NAME: string;

// Assign storage profile to default config
Object.assign(DEFAULT_CONFIG, {
  storageProfile: STORAGE_PROFILE
});

// make development profiles for user data
if (STORAGE_PROFILE) {
  app.setPath(
    "userData",
    resolve(app.getPath("appData"), `${APP_NAME}-${STORAGE_PROFILE}`)
  );
}

const PATH = resolve(app.getPath("userData"), "config");

function encode(text: string): string {
  return Buffer.from(text, "binary").toString("base64");
}

function decode(text: string): string {
  return Buffer.from(text, "base64").toString("binary");
}

function readConfig(): ApplicationConfig {
  const config = {};
  try {
    const text = fs.readFileSync(PATH, "utf-8");
    if (text) {
      return _.merge(config, JSON.parse(decode(text))) as ApplicationConfig;
    } else {
      return _.merge(config, DEFAULT_CONFIG) as ApplicationConfig;
    }
  } catch (error) {
    return _.merge(config, DEFAULT_CONFIG) as ApplicationConfig;
  }
}

type RecursiveReadonly<T> = {
  +readonly [P in keyof T]: RecursiveReadonly<T[P]>;
};

function makeReadonly<T>(obj: T): RecursiveReadonly<T> {
  if (!_.isObjectLike(obj)) return (obj as any) as RecursiveReadonly<T>;

  const cachedValue = {} as RecursiveReadonly<T>;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = makeReadonly(obj[key]);
      Object.defineProperty(cachedValue, key, {
        value,
        configurable: false,
        writable: false,
        enumerable: true
      });
    }
  }

  return cachedValue;
}

const cachedConfig = readConfig();
let cachedReadOnlyConfig = makeReadonly(cachedConfig);

// TODO: trigger IPC config updated
function writeConfig(config: ApplicationConfig): void {
  const text = encode(JSON.stringify(config));
  cachedReadOnlyConfig = makeReadonly(cachedConfig);
  fs.writeFileSync(PATH, text, "utf-8");
}

export function getConfig() {
  return cachedReadOnlyConfig;
}

export function setMainWindowConfig(config: WindowConfig) {
  cachedConfig.mainWindow = config;
  writeConfig(cachedConfig);
}

export function setUserPreferences(config: UserPreferences) {
  cachedConfig.userPreferences = _.merge(
    cachedConfig.userPreferences || {},
    config
  );
  writeConfig(cachedConfig);
}
