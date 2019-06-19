"use strict";

var fluid = require("infusion"),
    jqUnit = fluid.require("node-jqunit"),
    fs = require("fs"),
    path = require("path"),
    shelljs = require("shelljs");

var gpii = fluid.registerNamespace("gpii");
gpii.installerTests = fluid.registerNamespace("gpii.installerTests");

var machine = fluid.queryIoCSelector(fluid.rootComponent, "gpii.installerTests.machine")[0];
var config = machine.config;

jqUnit.module("Installer tests", {
    setup: function () {
    },
    teardown: function () {
    }
});

// Run the installer
jqUnit.test("Installer", function () {

    console.log("Running installer");

    var guestMsi = path.win32.join(config.shareDir, config.msi.substr(config.gpiiAppDir.length));
    var logFile = "c:\\windows\\Temp\\gpii-installer.log";

    machine.execElevated("msiexec /i " + guestMsi + " /quiet /l* " + logFile, {expectCode: "ignore"});

    // The exit code is 1, even when it succeeds. Check the log file for a successful looking string.
    var successString = "Installation completed successfully";
    var result = machine.shell(
        "Select-String " + logFile + " -Pattern \"" + successString + "\"");
    var success = result.stdout.replace(/\s+/g, " ").indexOf(successString) >= 0;

    jqUnit.assertTrue("Installer should succeed", success);
});

// Check the installer installed. It's safe to assume that the MSI installer worked if it said it did. However, these
// tests just check the sanity of the installer.
jqUnit.test("Check installed files", function () {

    var files = [
        "$env:PUBLIC\\Desktop\\Start Morphic.lnk",
        "$env:PUBLIC\\Desktop\\Reset Morphic.lnk",
        "${env:ProgramFiles(x86)}\\Morphic\\start.cmd",
        "${env:ProgramFiles(x86)}\\Morphic\\reset.cmd",
        "${env:ProgramFiles(x86)}\\Morphic\\windows\\morphic-app.exe"
    ];

    var fileString = files.map(function (s) {
        return "\"" + s + "\"";
    }).join(",");

    var result = machine.shell("Get-ChildItem -Name " + fileString, {expectCode: "ignore"});
    jqUnit.assertEquals("Certain files should have been installed", 0, result.code);
});

jqUnit.asyncTest("Morphic running", function () {

    var isRunning = function () {
        var result = machine.shell("Get-Process morphic-app", {expectCode: "ignore"});
        // It's running if there's 3+ matching processes.
        return result.code === 0 && /(morphic-app(\s|\S)*){3}/.test(result.stdout);
    };

    jqUnit.assertTrue("Morphic process should be running", isRunning());

    // Because the installer was invoked with elevated privileges, the same happens to the processes it starts.
    // Restart it as the normal user.
    console.log("Restarting the process as a normal user...");
    machine.shell("Stop-Process -Name morphic-app ; Wait-Process -name morphic-app", {expectCode: "ignore"});
    // Start it using the desktop link
    machine.execUser("explorer %PUBLIC%\\Desktop\\Start Morphic.lnk", {expectCode: "ignore"});

    // Wait for it to start (should be instant)
    gpii.installerTests.waitForCondition(isRunning, {pollDelay:1000, timeout:30000}).then(function () {
        jqUnit.start();
    }, jqUnit.fail);
});

/**
 * Ripped from WindowsUtilities.js:
 * Waits for a condition, by polling a given function. A promise is returned, resolving when the condition is met or
 * rejecting upon timeout. If the condition is already met, then the returned promise will be resolved.
 *
 * The function is called repeatedly (with a delay) until it returns a truthful value, or a period of time has elapsed.
 *
 * @param {Function} func The function to call which checks the condition.
 * @param {Object} [options] Options
 * @param {Any} options.conditionValue The value that the function will return to indicate the condition is met.
 *  This is compared using '===', but the default is to match any truthy value.
 * @param {Number} options.argument An argument to pass to the function.
 * @param {Number} options.timeout How long to wait (ms) before timing out, or null (default) for no timeout.
 * @param {Number} options.pollDelay The delay (ms) between each poll. 500ms by default.
 * @param {Boolean} options.dontReject If true, then resolve the promise with "timeout" instead of rejecting.
 * @param {Object} options.error The error object used when rejecting.
 */
gpii.installerTests.waitForCondition = function (func, options) {
    var defaultOptions = {
        timeout: null,
        pollDelay: 500,
        dontReject: false
    };
    options = fluid.extend(defaultOptions, options);

    var promise = fluid.promise();
    var startTime = process.hrtime();

    var checkCondition = function () {
        // See if the condition has been met.
        var returnValue = func(options.argument);
        var conditionMet;
        if (options.conditionValue === undefined) {
            conditionMet = !!returnValue;
        } else {
            conditionMet = (returnValue === options.conditionValue);
        }

        if (conditionMet) {
            promise.resolve();
        } else {
            // Check the time.
            var timedout = false;
            if (typeof(options.timeout) === "number") {
                var hr = process.hrtime(startTime);
                // combine seconds + nanoseconds into milliseconds
                var timeTakenMs = (hr[0] * 1000) + (hr[1] / 1e6);

                if (timeTakenMs >= options.timeout) {
                    timedout = true;
                    if (options.dontReject) {
                        promise.resolve("timeout");
                    } else {
                        promise.reject(options.error);
                    }
                }
            }

            if (!timedout) {
                setTimeout(checkCondition, options.pollDelay);
            }
        }
    };

    checkCondition();
    return promise;
};
