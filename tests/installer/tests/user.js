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

jqUnit.module("End-user tests", {
    setup: function () {
    },
    teardown: function () {
    }
});



gpii.installerTests.keyIn = function (key) {
    machine.execUser("powershell -ExecutionPolicy ByPass usb-key.ps1 " + key);
};

gpii.installerTests.keyOut = function (key) {
    machine.execUser("powershell -ExecutionPolicy ByPass usb-key.ps1 " + key + " -Remove");
};

gpii.installerTests.performKeyin = function (key) {
    var promise = fluid.promise();
    var settleTime = 5000;

    machine.screenshot(key, "before");
    gpii.installerTests.keyIn(key);

    setTimeout(function () {
        machine.screenshot(key, "keyin");
        gpii.installerTests.keyOut(key);
        setTimeout(function () {
            machine.screenshot(key, "keyout");
            promise.resolve();
        }, settleTime);
    }, settleTime);

    return promise;
};

jqUnit.asyncTest("Key-in", function () {
    var srcPath;

    if (gpii.installerTests.isGuest) {
        srcPath = "scripts\\usb-key.ps1";
    } else {
        // Upload the usb key script
        srcPath = machine.localShell("vagrant winrm-upload -t ./scripts/usb-key.ps1 " + config.vm, {expectCode: "ignore"}).stdout;
        if (!srcPath) {
            gpii.installerTests.fatalError("Failed to upload usb-key.ps1");
        }
    }
    // "install" it
    machine.shell("copy \"" + srcPath + "\" c:\\windows\\usb-key.ps1");

    jqUnit.expect(1);
    jqUnit.assert("nothing");
    gpii.installerTests.performKeyin("salem").then(jqUnit.start);


});
