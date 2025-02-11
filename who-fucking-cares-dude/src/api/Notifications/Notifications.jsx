/*
 * Yuricord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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
import { Settings } from "@api/Settings";
import { Queue } from "@utils/Queue";
import { ReactDOM } from "@webpack/common";
import NotificationComponent from "./NotificationComponent";
import { persistNotification } from "./notificationLog";
const NotificationQueue = new Queue();
let reactRoot;
let id = 42;
function getRoot() {
    if (!reactRoot) {
        const container = document.createElement("div");
        container.id = "vc-notification-container";
        document.body.append(container);
        reactRoot = ReactDOM.createRoot(container);
    }
    return reactRoot;
}
function _showNotification(notification, id) {
    const root = getRoot();
    return new Promise(resolve => {
        root.render(<NotificationComponent key={id} {...notification} onClose={() => {
                notification.onClose?.();
                root.render(null);
                resolve();
            }}/>);
    });
}
function shouldBeNative() {
    if (typeof Notification === "undefined")
        return false;
    const { useNative } = Settings.notifications;
    if (useNative === "always")
        return true;
    if (useNative === "not-focused")
        return !document.hasFocus();
    return false;
}
export async function requestPermission() {
    return (Notification.permission === "granted" ||
        (Notification.permission !== "denied" && (await Notification.requestPermission()) === "granted"));
}
export async function showNotification(data) {
    persistNotification(data);
    if (shouldBeNative() && await requestPermission()) {
        const { title, body, icon, image, onClick = null, onClose = null } = data;
        const n = new Notification(title, {
            body,
            icon,
            // @ts-expect-error ts is drunk
            image
        });
        n.onclick = onClick;
        n.onclose = onClose;
    }
    else {
        NotificationQueue.push(() => _showNotification(data, id++));
    }
}
