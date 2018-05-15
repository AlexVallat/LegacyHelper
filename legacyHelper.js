"use strict";

const { utils: Cu , classes: Cc, interfaces: Ci} = Components;

const globalMessageManager = Cc["@mozilla.org/globalmessagemanager;1"].getService();

ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetters(this, {
    ConsoleAPI: "resource://gre/modules/Console.jsm",
    FileUtils: "resource://gre/modules/FileUtils.jsm",
    ZipUtils: "resource://gre/modules/ZipUtils.jsm"
});
XPCOMUtils.defineLazyServiceGetter(this, "styleSheetService",
    "@mozilla.org/content/style-sheet-service;1",
    "nsIStyleSheetService");

function remove(array, value) {
    const index = array.indexOf(value);
    if (index !== -1) {
        array.splice(index, 1);
    }
}

function ArrayEnumerator(aItems) {
    this._index = 0;
    this._contents = aItems;
}

ArrayEnumerator.prototype = {
    _index: 0,

    hasMoreElements() {
        return this._index < this._contents.length;
    },

    getNext() {
        return this._contents[this._index++];
    }
};

this.legacy = class extends ExtensionAPI {
    getAPI(context) {
        const loadedDelayedFrameScripts = [];
        const unloadMessages = [];
        const loadedBootstrapSandboxes = {};
        const loadedStyleSheets = [];
        const chromeOverrideRelativePaths = [];
        const temporaryFolders = [];

        let chromeOverrideProvider;
        
        const messageSender = {
            _listeners: [],

            sendMessage: function (message) {
                const responses = [];
                for (const listener of this._listeners) {
                    responses.push(listener.async(message));
                }

                // Only the first responder is used, other responses are ignored
                return Promise.race(responses);
            },

            addListener(fire) {
                this._listeners.push(fire);
            },

            removeListener(fire) {
                remove(this._listeners, fire);
            }
        }

	    const api = {
	        legacy: {
                async loadFrameScript(uri, allowDelayedLoad, runInGlobalScope) {
                    globalMessageManager.loadFrameScript(uri, allowDelayedLoad, runInGlobalScope);
	                if (allowDelayedLoad) {
                        loadedDelayedFrameScripts.push(uri);
	                }
                },

                async removeDelayedFrameScript(uri) {
                    globalMessageManager.removeDelayedFrameScript(uri);

                    // Remove from the list of loaded scripts to unload at extension disable
                    remove(loadedDelayedFrameScripts, uri);
	            },

	            async addUnloadMessage(messageName, data) {
	                unloadMessages.push({ name: messageName, data: data });
	            },

	            async broadcastAsyncMessage(messageName, data) {
	                globalMessageManager.broadcastAsyncMessage(messageName, data);
                },

                async loadBootstrapScript(uri) {
                    const runStartup = function(sandbox, reason) {
                        try {
                            const startupFunction = sandbox["startup"];
                            if (!startupFunction) {
                                console.log("error: startup() function not present");
                            }
                            startupFunction.call(sandbox, context.extension.addonData, reason, messageSender);
                        } catch (e) {
                            console.log("error calling startup() function: " + e);
                            return;
                        }
                    }

                    const existingScriptSandbox = loadedBootstrapSandboxes[uri];
                    if (existingScriptSandbox) {
                        runStartup(existingScriptSandbox, null);
                    }

                    const aId = context.extension.id;
                    const principal = Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal);
                    const sandbox = new Cu.Sandbox(principal, {
                        sandboxName: uri,
                        addonId: aId,
                        wantGlobalProperties: ["ChromeUtils"],
                        metadata: { addonID: aId, URI: uri }
                    });

                    // Define a console
                    XPCOMUtils.defineLazyGetter(
                        sandbox, "console",
                        () => new ConsoleAPI({ consoleID: "addon/" + aId }));

                    sandbox.__SCRIPT_URI_SPEC__ = uri;

                    Services.scriptloader.loadSubScript(uri, sandbox);
                   
                    runStartup(sandbox, context.extension.startupReason);
                
                    let test = sandbox["shutdown"];
                    if (test) {
                        loadedBootstrapSandboxes[uri] = sandbox;
                    } else {
                        console.log("warning: shutdown() function not present");
                    }
                },

                async callFunctionInBootstrapScript(uri, functionName, data) {
                    const existingScriptSandbox = loadedBootstrapSandboxes[uri];
                    if (existingScriptSandbox) {
                        try {
                            const fun = existingScriptSandbox[functionName];
                            if (!fun) {
                                return Promise.reject(new Error("error: " + functionName + " function not present"));
                            }
                            const clonedDetails = Cu.cloneInto(data, existingScriptSandbox);
                            return Promise.resolve(fun.call(existingScriptSandbox, clonedDetails));
                        } catch (e) {
                            return Promise.reject(new Error("error calling: " + functionName + e));
                        }
                    } else {
                        return Promise.reject(new Error("bootstrap script not found: " + uri));
                    }
                },

                onBootstrapScriptMessage: new ExtensionCommon.EventManager(context, "legacy.onBootstrapScriptMessage", fire => {
                    messageSender.addListener(fire);
                    return () => {
                        messageSender.removeListener(fire);
                    };
                }).api(),

                async loadStyleSheet(uri, type) {
                    const styleSheetUri = Services.io.newURI(uri, null, null);
                    styleSheetService.loadAndRegisterSheet(styleSheetUri, type);

                    loadedStyleSheets.push({ uri: styleSheetUri, type: type });
                },

                async isStyleSheetLoaded(uri, type) {
                    return styleSheetService.sheetRegistered(Services.io.newURI(uri, null, null), type);
                },

                async unloadStyleSheet(uri, type) {
                    styleSheetService.unregisterSheet(Services.io.newURI(uri, null, null), type);
                },

                async registerChromeOverride(path) {
                    chromeOverrideRelativePaths.push(path);

                    if (!chromeOverrideProvider) {
                        let rootPath;
                        if (context.extension.rootURI instanceof Ci.nsIFileURL) {
                            rootPath = context.extension.rootURI.file;
                        } else {
                            // This is a packaged extension, and needs to be unpacked before chrome files can be read
                            const tempFolder = FileUtils.getFile("TmpD", [context.extension.id]);
                            tempFolder.createUnique(Components.interfaces.nsIFile.DIRECTORY_TYPE, FileUtils.PERMS_DIRECTORY);
                            ZipUtils.extractFilesAsync(context.extension.addonData.installPath, tempFolder);

                            temporaryFolders.push(tempFolder); // Store the temp folder for cleanup on shutdown

                            // Use the extracted location as the root path instead
                            rootPath = tempFolder;
                        }

                        chromeOverrideProvider = {
                            getFiles: function(prop) {
                                if (prop === "AChromDL") {
                                    return new ArrayEnumerator(chromeOverrideRelativePaths.map(relativePath => {
                                        const path = rootPath.clone();
                                        path.appendRelativePath(relativePath);
                                        return path;
                                    }));
                                }
                            },
                            QueryInterface: XPCOMUtils.generateQI([Ci.nsIDirectoryServiceProvider2])
                        };
                        Services.dirsvc.registerProvider(chromeOverrideProvider);
                    }
                },

                close: function () {
                    loadedDelayedFrameScripts.forEach(uri => globalMessageManager.removeDelayedFrameScript(uri));
                    unloadMessages.forEach(unloadMessage => globalMessageManager.broadcastAsyncMessage(unloadMessage.name, unloadMessage.data));
                    Object.values(loadedBootstrapSandboxes).forEach(sandbox => sandbox["shutdown"].call(sandbox, context.extension.addonData, context.extension.shutdownReason));
                    loadedStyleSheets.forEach(styleSheet => styleSheetService.unregisterSheet(styleSheet.uri, styleSheet.type));
                    temporaryFolders.forEach(tempFolder => tempFolder.remove(true));

                    if (chromeOverrideProvider) {
                        Services.dirsvc.unregisterProvider(chromeOverrideProvider);
                    }
                }
	        }
        };
        context.extension.callOnClose(api.legacy);
	    return api;
	}
}