/*
 * Yuricord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import "./updater";
import "./ipcPlugins";
import "./settings";
import { debounce } from "@shared/debounce";
import { BrowserWindow, ipcMain, shell, systemPreferences } from "electron";
import monacoHtml from "file://monacoWin.html?minify&base64";
import { mkdirSync, watch, writeFileSync } from "fs";
import { open, readdir, readFile } from "fs/promises";
import { join, normalize } from "path";
import { getThemeInfo, stripBOM } from "./themes";
import { ALLOWED_PROTOCOLS, QUICKCSS_PATH, THEMES_DIR } from "./utils/constants";
import { makeLinksOpenExternally } from "./utils/externalLinks";
mkdirSync(THEMES_DIR, { recursive: true });
export function ensureSafePath(basePath, path) {
    const normalizedBasePath = normalize(basePath);
    const newPath = join(basePath, path);
    const normalizedPath = normalize(newPath);
    return normalizedPath.startsWith(normalizedBasePath) ? normalizedPath : null;
}
function readCss() {
    return readFile(QUICKCSS_PATH, "utf-8").catch(() => "");
}
async function listThemes() {
    const files = await readdir(THEMES_DIR).catch(() => []);
    const themeInfo = [];
    for (const fileName of files) {
        if (!fileName.endsWith(".css"))
            continue;
        const data = await getThemeData(fileName).then(stripBOM).catch(() => null);
        if (data == null)
            continue;
        themeInfo.push(getThemeInfo(data, fileName));
    }
    return themeInfo;
}
function getThemeData(fileName) {
    fileName = fileName.replace(/\?v=\d+$/, "");
    const safePath = ensureSafePath(THEMES_DIR, fileName);
    if (!safePath)
        return Promise.reject(`Unsafe path ${fileName}`);
    return readFile(safePath, "utf-8");
}
ipcMain.handle("YuricordOpenQuickCss" /* IpcEvents.OPEN_QUICKCSS */, () => shell.openPath(QUICKCSS_PATH));
ipcMain.handle("YuricordOpenExternal" /* IpcEvents.OPEN_EXTERNAL */, (_, url) => {
    try {
        var { protocol } = new URL(url);
    }
    catch {
        throw "Malformed URL";
    }
    if (!ALLOWED_PROTOCOLS.includes(protocol))
        throw "Disallowed protocol.";
    shell.openExternal(url);
});
ipcMain.handle("YuricordGetQuickCss" /* IpcEvents.GET_QUICK_CSS */, () => readCss());
ipcMain.handle("YuricordSetQuickCss" /* IpcEvents.SET_QUICK_CSS */, (_, css) => writeFileSync(QUICKCSS_PATH, css));
ipcMain.handle("YuricordGetThemesDir" /* IpcEvents.GET_THEMES_DIR */, () => THEMES_DIR);
ipcMain.handle("YuricordGetThemesList" /* IpcEvents.GET_THEMES_LIST */, () => listThemes());
ipcMain.handle("YuricordGetThemeData" /* IpcEvents.GET_THEME_DATA */, (_, fileName) => getThemeData(fileName));
ipcMain.handle("YuricordGetThemeSystemValues" /* IpcEvents.GET_THEME_SYSTEM_VALUES */, () => ({
    // win & mac only
    "os-accent-color": `#${systemPreferences.getAccentColor?.() || ""}`
}));
export function initIpc(mainWindow) {
    let quickCssWatcher;
    open(QUICKCSS_PATH, "a+").then(fd => {
        fd.close();
        quickCssWatcher = watch(QUICKCSS_PATH, { persistent: false }, debounce(async () => {
            mainWindow.webContents.postMessage("YuricordQuickCssUpdate" /* IpcEvents.QUICK_CSS_UPDATE */, await readCss());
        }, 50));
    }).catch(() => { });
    const themesWatcher = watch(THEMES_DIR, { persistent: false }, debounce(() => {
        mainWindow.webContents.postMessage("YuricordThemeUpdate" /* IpcEvents.THEME_UPDATE */, void 0);
    }));
    mainWindow.once("closed", () => {
        quickCssWatcher?.close();
        themesWatcher.close();
    });
}
ipcMain.handle("YuricordOpenMonacoEditor" /* IpcEvents.OPEN_MONACO_EDITOR */, async () => {
    const title = "Yuricord QuickCSS Editor";
    const existingWindow = BrowserWindow.getAllWindows().find(w => w.title === title);
    if (existingWindow && !existingWindow.isDestroyed()) {
        existingWindow.focus();
        return;
    }
    const win = new BrowserWindow({
        title,
        autoHideMenuBar: true,
        darkTheme: true,
        webPreferences: {
            preload: join(__dirname, IS_DISCORD_DESKTOP ? "preload.js" : "YuricordDesktopPreload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });
    makeLinksOpenExternally(win);
    await win.loadURL(`data:text/html;base64,${monacoHtml}`);
});
