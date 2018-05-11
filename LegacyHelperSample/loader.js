"use strict";
console.log("LegacyTest loader");

browser.legacy.loadFrameScript(browser.runtime.getURL("framescript.js"), true);
browser.legacy.addUnloadMessage("LegacyTest@byalexv.co.uk:disable");

const bootstrapScript = browser.runtime.getURL("bootstrap.js");
browser.legacy.loadBootstrapScript(bootstrapScript);

const styleSheet = browser.runtime.getURL("stylesheet.css");
browser.legacy.loadStyleSheet(styleSheet, browser.legacy.AUTHOR_SHEET).then(function () {
    browser.legacy.isStyleSheetLoaded(styleSheet, browser.legacy.AUTHOR_SHEET).then(result => console.log("Stylesheet loaded: ", result));
    setTimeout(() => browser.legacy.unloadStyleSheet(styleSheet, browser.legacy.AUTHOR_SHEET).then(() =>
        browser.legacy.isStyleSheetLoaded(styleSheet, browser.legacy.AUTHOR_SHEET)).then(result => console.log("Stylesheet loaded after unloading: ", result)), 2000);
});

setTimeout(function () {
    console.log("calling bootstrap script test callback");
    browser.legacy.callFunctionInBootstrapScript(bootstrapScript, "testCallback", { "callback string": 2 }).then(result => console.log("test callback result: ", result));

    console.log("broadcasting async message to framescripts");
    browser.legacy.broadcastAsyncMessage("LegacyTestBroadcast", { "broadcast string": 3 });
}, 1000);

browser.legacy.onBootstrapScriptMessage.addListener(function (message) {
    console.log("loader received message: ", message);
    return { result: "loader response to message" };
});