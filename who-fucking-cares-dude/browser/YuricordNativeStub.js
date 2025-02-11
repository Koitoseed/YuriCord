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
/// <reference path="../src/modules.d.ts" />
/// <reference path="../src/globals.d.ts" />
import monacoHtmlLocal from "file://monacoWin.html?minify";
import monacoHtmlCdn from "file://../src/main/monacoWin.html?minify";
import * as DataStore from "../src/api/DataStore";
import { debounce } from "../src/utils";
import { EXTENSION_BASE_URL } from "../src/utils/web-metadata";
import { getTheme } from "../src/utils/discord";
import { getThemeInfo } from "../src/main/themes";
// Discord deletes this so need to store in variable
const { localStorage } = window;
// listeners for ipc.on
const cssListeners = new Set();
const NOOP = () => { };
const NOOP_ASYNC = async () => { };
const setCssDebounced = debounce((css) => YuricordNative.quickCss.set(css));
const themeStore = DataStore.createStore("YuricordThemes", "YuricordThemeData");
// probably should make this less cursed at some point
window.YuricordNative = {
    themes: {
        uploadTheme: (fileName, fileData) => DataStore.set(fileName, fileData, themeStore),
        deleteTheme: (fileName) => DataStore.del(fileName, themeStore),
        getThemesDir: async () => "",
        getThemesList: () => DataStore.entries(themeStore).then(entries => entries.map(([name, css]) => getThemeInfo(css, name.toString()))),
        getThemeData: (fileName) => DataStore.get(fileName, themeStore),
        getSystemValues: async () => ({}),
    },
    native: {
        getVersions: () => ({}),
        openExternal: async (url) => void open(url, "_blank")
    },
    updater: {
        getRepo: async () => ({ ok: true, value: "https://github.com/Vendicated/Yuricord" }),
        getUpdates: async () => ({ ok: true, value: [] }),
        update: async () => ({ ok: true, value: false }),
        rebuild: async () => ({ ok: true, value: true }),
    },
    quickCss: {
        get: () => DataStore.get("YuricordQuickCss").then(s => s ?? ""),
        set: async (css) => {
            await DataStore.set("YuricordQuickCss", css);
            cssListeners.forEach(l => l(css));
        },
        addChangeListener(cb) {
            cssListeners.add(cb);
        },
        addThemeChangeListener: NOOP,
        openFile: NOOP_ASYNC,
        async openEditor() {
            const features = `popup,width=${Math.min(window.innerWidth, 1000)},height=${Math.min(window.innerHeight, 1000)}`;
            const win = open("about:blank", "YuricordQuickCss", features);
            if (!win) {
                alert("Failed to open QuickCSS popup. Make sure to allow popups!");
                return;
            }
            win.baseUrl = EXTENSION_BASE_URL;
            win.setCss = setCssDebounced;
            win.getCurrentCss = () => YuricordNative.quickCss.get();
            win.getTheme = () => getTheme() === 2 /* Theme.Light */
                ? "vs-light"
                : "vs-dark";
            win.document.write(IS_EXTENSION ? monacoHtmlLocal : monacoHtmlCdn);
        },
    },
    settings: {
        get: () => {
            try {
                return JSON.parse(localStorage.getItem("YuricordSettings") || "{}");
            }
            catch (e) {
                console.error("Failed to parse settings from localStorage: ", e);
                return {};
            }
        },
        set: async (s) => localStorage.setItem("YuricordSettings", JSON.stringify(s)),
        getSettingsDir: async () => "LocalStorage"
    },
    pluginHelpers: {},
};
