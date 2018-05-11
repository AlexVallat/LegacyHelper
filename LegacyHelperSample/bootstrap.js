"use strict";
Components.utils.import("resource://gre/modules/Timer.jsm");

function startup(data, reason, messageSender) {
    console.log("Bootstrap script startup: " + reason, data);
    setTimeout(() => messageSender.sendMessage({string: "message from bootstrap", details: 5 }).then(result => console.log("result from loader: ", result)));
}

function shutdown(data, reason) {
    console.log("Bootstrap script shutdown: " + reason, data);
}

function testCallback(details) {
    console.log("Bootstrap script test callback received:", details);
    return details;
}

console.log("Bootstrap script loaded");
