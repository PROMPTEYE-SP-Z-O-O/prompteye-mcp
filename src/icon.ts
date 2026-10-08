import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const ICON_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/icon.png");

/** The PromptEye mark a client shows beside the server, inlined so it needs no hosting. */
export const SERVER_ICONS = [
  {
    src: `data:image/png;base64,${fs.readFileSync(ICON_PATH).toString("base64")}`,
    mimeType: "image/png",
    sizes: ["512x512"],
  },
];
