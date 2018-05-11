document.getElementById("showBranchedHistory").addEventListener("change", function (event) {
    setElementEnabled(document.getElementById("menuStructure"), event.target.checked);
});

document.getElementById("copyHistoryOnNewWindow").addEventListener("change", function (event) {
    setElementEnabled(document.getElementById("parentClickTimeoutWindow"), event.target.checked);
    setElementEnabled(document.getElementById("parentClickTimeoutWindowAuto"), event.target.checked);
});

document.getElementById("copyHistoryOnNewTab").addEventListener("change", function (event) {
    setElementEnabled(document.getElementById("parentClickTimeoutTab"), event.target.checked);
    setElementEnabled(document.getElementById("parentClickTimeoutTabAuto"), event.target.checked);
});


var setElementEnabled = function (element, enabled) {
    if (enabled) {
        element.removeAttribute("disabled");
    } else {
        element.setAttribute("disabled", "true");
    }
}

document.addEventListener("change", function (event) {
    const value = (event.target.type === "checkbox") ? event.target.checked : Number(event.target.value);

    browser.runtime.sendMessage({
        name: "SetPref",
        data: {
            key: event.target.id,
            value: value
        }
    });
});

document.getElementById("parentClickTimeoutWindowAuto").addEventListener("click", function(event) {
    browser.runtime.sendMessage({
        name: "Calibrate",
        data: "parentClickTimeoutWindow"
    }).then(result => document.getElementById("parentClickTimeoutWindow").value = result);
});

document.getElementById("parentClickTimeoutTabAuto").addEventListener("click", function (event) {
    browser.runtime.sendMessage({
        name: "Calibrate",
        data: "parentClickTimeoutTab"
    }).then(result => document.getElementById("parentClickTimeoutTab").value = result);
});

document.getElementById("helpButton").addEventListener("click", function (event) {
    browser.runtime.sendMessage({
        name: "ShowHelp"
    });
});

browser.runtime.sendMessage({
    name: "GetPrefs"
}).then(prefs => {
    for (const [id, value] of Object.entries(prefs)) {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === "checkbox") {
                element.checked = value;
            } else {
                element.value = value;
            }
            element.dispatchEvent(new Event("change"));
        }
    }
});