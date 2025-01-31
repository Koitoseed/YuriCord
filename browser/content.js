if (typeof browser === "undefined") {
    var browser = chrome;
}

const style = document.createElement("link");
style.type = "text/css";
style.rel = "stylesheet";
style.href = browser.runtime.getURL("dist/Yuricord.css");

document.addEventListener(
    "DOMContentLoaded",
    () => {
        document.documentElement.append(style);
        window.postMessage({
            type: "Yuricord:meta",
            meta: {
                EXTENSION_VERSION: browser.runtime.getManifest().version,
                EXTENSION_BASE_URL: browser.runtime.getURL(""),
            }
        });
    },
    { once: true }
);


