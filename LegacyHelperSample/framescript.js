console.log("Legacy Test Framescript loaded");

function unload() {
    console.log("Framescript received unload message");
    removeMessageListener("LegacyTest@byalexv.co.uk:disable", unload);
    removeMessageListener("LegacyTestBroadcast", receiveBroadcast);
}

function receiveBroadcast(message) {
    console.log("Framescript received broadcast message: ", message.data);
};

addMessageListener("LegacyTest@byalexv.co.uk:disable", unload);
addMessageListener("LegacyTestBroadcast", receiveBroadcast);