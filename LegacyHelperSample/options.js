
document.getElementById("testButton").addEventListener("click", function (event) {
    browser.runtime.sendMessage({
        name: "TestButtonClicked",
        parameter: document.getElementById("testCheckbox").checked
    });
});

browser.runtime.sendMessage({
    name: "GetButtonLabel"
}).then(result => document.getElementById("testButton").textContent = result);