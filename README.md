# Legacy Helper
A Firefox WebExtension Experiment addon to provide unrestricted legacy addon functionality to WebExtension addons.

By policy and design, WebExtensions are more restricted than the legacy addons they are intended to replace. This means that some of the functionality that legacy addons could provide is no longer possible to do as a WebExtension.

This addon should be regarded as similar to rooting your phone. It is expressely bypassing the restrictions and permissions for WebExtensions for addons that use it. Needless to say, **_if an addon requires you to install this helper, only do so if you trust that addon completely!_**

## Installation
This addon can only be installed in [Firefox Developer Edition](https://developer.mozilla.org/en-US/Firefox/Developer_Edition) or [Nightly](https://nightly.mozilla.org/). First, set the `extensions.legacy.enabled` preference in `about:config` to `true`. Then install LegacyHelper.xpi from [Latest Release](https://github.com/AlexVallat/LegacyHelper/releases/latest).

## Usage
Other addons may depend on this addon for their functionality. It does nothing on its own, and only needs to be installed if another addon has requested it.

## Developers
To use the Legacy Helper from your own addon, include in the `manifest.json` permissions array the permission: `experiments.legacyHelper`. For example:

```JSON
"permissions": [
	"experiments.legacyHelper"
]
```


All legacy code must be in its own, separate, script files. These can be loaded either as framescripts (content) or as bootstrap (background) scripts.

### Loading a legacy framescript
Legacy framescripts (for the content process) are loaded using the `loadFrameScript(uri, allowDelayedLoad, [optional] runInGlobalScope)` function. If the `allowDelayedLoad` parameter is set true, then `removeDelayedFrameScript` will automatically be called when the addon is unloaded.

```JavaScript
browser.legacy.loadFrameScript(browser.runtime.getURL("content.js"), true);
```

If the `runInGlobalScope` is true then the frame script scope will be shared with other frame scripts that have this flag set true.

Messages may be broadcast to all legacy framescripts using the `broadcastAsyncMessage` function.

### Loading a legacy bootstrap script
Legacy bootstrap scripts (for the chrome process) are loaded using the `loadBootstrapScript(uri)` function. There is no requirement for it to be named bootstrap.js. Once loaded, the `startup(data, reason, messageSender)` function will be called. When the addon is unloaded, `shutdown(data, reason)` will be called.

If this function is called again for the same script uri, it won't be re-loaded, but `startup()` will be called again.

The `reason` parameters is passed as a string rather than a constant, for example `"ADDON_INSTALL"` or `"ADDON_DISABLE"`.

The `messageSender` parameter passed to `startup` can be used to send a message back to the WebExtension by calling `messageSender.sendMessage(message)`. This will be raised by the `onBootstrapScriptMessage` event, so the WebExtension may listen for it using `browser.legacy.onBootstrapScriptMessage.addListener(listener)`. A response to the message may be returned as a `Promise`.

### Loading a legacy style sheet
Legacy style sheets are loaded using the  `loadStyleSheet(uri, type)` function. The `type` paramter should be one of `browser.legacy.AGENT_SHEET`, `browser.legacy.USER_SHEET` or `browser.legacy.AUTHOR_SHEET`. Style sheets will be automatically unloaded when the addon is unloaded.

Additional helper functions: `isStyleSheetLoaded(uri, type)` and `unloadStyleSheet(uri, type)` are also provided.

### Loading legacy chrome overrides
Addons used to be able to place files within a chrome folder. This functionality can be reproduced by calling `registerChromeOverride` and passing the path to the chrome folder, relative to the addon root.

```JavaScript
browser.legacy.registerChromeOverride("chrome", true);
```

### Cleaning up on uninstall/disable
Delayed framescripts are automatically removed, but it is not possible to unload a framescript that has already been loaded into a tab. Accepted practice is to broadcast a message which notifies the framescripts to disable themselves. To assist with this, an `addUnloadMessage(messageName, data)` function is provided. When the addon is unloaded, this message will be broadcast to all framescripts.

For bootstrap scripts, the `shutdown` function will be called.

Style sheets will be automatcially unloaded.

```JavaScript
//background.js
    browser.legacy.loadBootstrapScript(browser.runtime.getURL("bootstrap.js"));
    browser.legacy.loadFrameScript(browser.runtime.getURL("content.js"), true);    
    browser.legacy.addUnloadMessage("myAddonDisableMessage");

//content.js:
    addMessageListener("myAddonDisableMessage", function () {
       // clean up framescript 
    });

//bootstrap.js
    shutdown() {
        // clean up bootstrap script
    }
```
