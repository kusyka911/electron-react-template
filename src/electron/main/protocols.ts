import { join } from "path";
import { protocol, ProtocolRequest, Protocol, shell, Event, app } from "electron";
// import { logger } from "./logging";

export function createFileProtocol(scheme: string, root: string = __dirname): void {
  protocol.registerFileProtocol(scheme, (request, respond) => {
    let path = new URL(request.url).pathname;
    path = decodeURI(path); // Needed in case URL contains spaces
    path = join(root, path);
    respond({ path });
  });
}

// TODO: Streaming protocol for video attachments

function disableProtocolHandler(request: ProtocolRequest, callback: VoidFunction) {
  return callback();
}

export function instalProtocolHandlers(protocol: Protocol, isDev: boolean): void {
  const schemas = [
    "about",
    "content",
    "chrome",
    "cid",
    "data",
    "filesystem",
    "ftp",
    "gopher",
    "javascript",
    "mailto"
  ];
  if (!isDev) schemas.push("http", "https", "ws", "wss");
  schemas.forEach(scheme => {
    protocol.interceptFileProtocol(scheme, disableProtocolHandler as any);
  });
}

export async function handleUrl(event: Event, url: string): Promise<void> {
  if (!app.isPackaged && /localhost/.test(url)) return;
  event.preventDefault();
  try {
    await shell.openExternal(url);
  } catch (error) {
    // logger.warn("Failed to open url", { url: target });
    console.warn("Failed to open url", { url });
  }
}
