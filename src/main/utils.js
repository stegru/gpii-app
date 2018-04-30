/**
 * PSP utility functions
 *
 * A set of utility function used throughout the components used in the main process of the PSP.
 * Copyright 2016 Steven Githens
 * Copyright 2016-2017 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 * The research leading to these results has received funding from the European Union's
 * Seventh Framework Programme (FP7/2007-2013) under grant agreement no. 289016.
 * You may obtain a copy of the License at
 * https://github.com/GPII/universal/blob/master/LICENSE.txt
 */
"use strict";

var os       = require("os");
var fluid    = require("infusion");
var electron = require("electron");
var ipcMain  = electron.ipcMain;

var gpii = fluid.registerNamespace("gpii");
fluid.registerNamespace("gpii.app");

/**
 * Returns whether the underlying OS is Windows 10 or not.
 * @return {Boolean} `true` if the underlying OS is Windows 10 or
 * `false` otherwise.
 */
gpii.app.isWin10OS = function () {
    var osRelease = os.release(),
        delimiter = osRelease.indexOf("."),
        majorVersion = osRelease.slice(0, delimiter);
    return majorVersion === "10";
};

/**
* Gets the desired bounds (i.e. the coordinates and the width and
* height, the latter two being restricted by the corresponding
* dimensions of the primary display) of an Electron `BrowserWindow`
* given its width and height. If used in the `window.setBounds`
* function of the `BrowserWindow`, the window will be positioned
* in  the lower right corner of the primary display.
* @param width {Number} The width of the `BrowserWindow`.
* @param height {Number} The height of the `BrowserWindow`.
* @return {{x: Number, y: Number, width: Number, height: Number}}
*/
gpii.app.getDesiredWindowBounds = function (width, height) {
    var screenSize = electron.screen.getPrimaryDisplay().workAreaSize;
    width = Math.ceil(Math.min(width, screenSize.width));
    height = Math.ceil(Math.min(height, screenSize.height));
    return {
        x: Math.ceil(screenSize.width - width),
        y: Math.ceil(screenSize.height - height),
        width: width,
        height: height
    };
};

/**
 * Positions an Electron `BrowserWindow` in the lower right corner of
 * the primary display.
 * @param dialogWindow {BrowserWindow} The window which is to be positioned.
 */
gpii.app.positionWindow = function (dialogWindow) {
    var size = dialogWindow.getSize(),
        bounds = gpii.app.getDesiredWindowBounds(size[0], size[1]);
    dialogWindow.setPosition(bounds.x, bounds.y);
};

/**
 * A function which capitalizes its input text. It does nothing
 * if the provided argument is `null` or `undefined`.
 * @param text {String} The input text.
 * @return {String} the capitalized version of the input text.
 */
gpii.app.capitalize = function (text) {
    if (fluid.isValue(text)) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
};

/**
 * Sends a message to the given Electron `BrowserWindow`
 *
 * @param window {Object} An Electron `BrowserWindow` object
 * @param messageChannel {String} The channel to which the message to be sent
 * @param message {String}
 */
gpii.app.notifyWindow = function (browserWindow, messageChannel, message) {
    if (browserWindow) {
        browserWindow.webContents.send(messageChannel, message);
    }
};

/**
 * Checks if a hash is not empty, i.e. if it contains at least one key.
 * Note that the values are not examined.
 * @param hash {Object} An arbitrary object.
 * @return `true` is the hash has at least one key and `false` otherwise.
 */
gpii.app.isHashNotEmpty = function (hash) {
    return hash && fluid.keys(hash).length > 0;
};

/*
 * A simple wrapper for the native timeout. Responsible for clearing the interval
 * upon component destruction.
 */
fluid.defaults("gpii.app.timer", {
    gradeNames: ["fluid.modelComponent"],

    members: {
        timer: null
    },

    listeners: {
        "onDestroy.clearTimer": "{that}.clear"
    },

    events: {
        onTimerFinished: null
    },

    invokers: {
        start: {
            funcName: "gpii.app.timer.start",
            args: [
                "{that}",
                "{arguments}.0" // timeoutDuration
            ]
        },
        clear: {
            funcName: "gpii.app.timer.clear",
            args: ["{that}"]
        }
    }
});

/**
 * Starts a timer. In `timeoutDuration` milliseconds, the `onTimerFinished`
 * event will be fired. Any previously registered timers will be cleared
 * upon the invokation of this function.
 * that {Component} The `gpii.app.timer` instance.
 * timeoutDuration {Number} The timeout duration in milliseconds.
 */
gpii.app.timer.start = function (that, timeoutDuration) {
    that.clear();
    that.timer = setTimeout(that.events.onTimerFinished.fire, timeoutDuration);
};

/**
 * Clears the timer.
 * that {Component} The `gpii.app.timer` instance.
 */
gpii.app.timer.clear = function (that) {
    if (that.timer) {
        clearTimeout(that.timer);
        that.timer = null;
    }
};

/**
 * Generic channel component for comunication with BroserWindows
 * It simply registers listeners for passes events (in the whole main)
 */
fluid.defaults("gpii.app.dialog.simpleEventChannel", {
    gradeNames: "fluid.component",

    events: {}, // to be passed by implementor

    listeners: {
        "onCreate.registerIpcListeners": {
            funcName: "gpii.app.dialog.simpleEventChannel.registerIPCListenersBasedOnEvents",
            args: "{that}.events"
        },
        "onDestroy.deregisterIpcListeners": {
            funcName: "gpii.app.dialog.simpleEventChannel.deregisterIPCListenersBasedOnEvents",
            args: "{that}.events"
        }
    }
});


/**
 * Register simple IPC socket listeners for all given events. In case anything is written to
 * the channel, the corresponding event is triggered.
 *
 * @param events {Object} The events to be used.
 */
gpii.app.dialog.simpleEventChannel.registerIPCListenersBasedOnEvents = function (events) {
    fluid.each(events, function (event, eventName) {
        gpii.app.dialog.simpleEventChannel.registerIPCListener(eventName, event);
    });
};

/**
 * Deregister all socket listeners for the specified events.
 *
 * @param events {Object} The events to be used.
 */
gpii.app.dialog.simpleEventChannel.deregisterIPCListenersBasedOnEvents = function (events) {
    fluid.keys(events).forEach(gpii.app.dialog.simpleEventChannel.registerIPCListener);
};


/**
 * Register single IPC socket channel
 *
 * @param channelName {String} The name of the channel to be listened to
 * @param event {Object} The event to be fired when the channel is notified
 */
gpii.app.dialog.simpleEventChannel.registerIPCListener = function (channelName, event) {
    ipcMain.on(channelName, function (/* event, args... */) {
        event.fire.apply(event, [].slice.call(arguments, 1));
    });
};


/**
 * Deregister a socket listener.
 *
 * @param channelName {String} The channel to be disconnected from
 */
gpii.app.dialog.simpleEventChannel.deregisterIPCListener = function (channelName) {
    ipcMain.removeAllListeners(channelName);
};

/**
 * Set proper context for arrays.
 * This is needed in order for arrays to pass the more strict
 * check of: `instanceof array`. In general such checks are to be avoided
 * in favor of the `fluid.isArray` function, but is useful when dealing with
 * third party dependencies.
 * Related to: https://github.com/electron/electron/issues/12698
 *
 * @param {Object|Array} object - The object/array that needs to have its contexts fixed.
 * @returns {Object} The fixed object
 */
gpii.app.recontextualise = function (object) {
    if (!fluid.isPlainObject(object)) {
        return;
    }
    if (fluid.isArrayable(object)) {
        object = [].slice.call(object);
    }

    fluid.each(object, function (value, key) {
        if (fluid.isArrayable(object[key])) {
            // console.log(value);
            object[key] = [].slice.call(object[key]);
        }
        gpii.app.recontextualise(object[key]);
    });

    return object;
};
