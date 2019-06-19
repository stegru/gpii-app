"use strict";

var fluid = require("infusion"),
    jqUnit = fluid.require("node-jqunit"),
    fs = require("fs");

var gpii = fluid.registerNamespace("gpii");
gpii.installerTests = fluid.registerNamespace("gpii.installerTests");

var machine = fluid.queryIoCSelector(fluid.rootComponent, "gpii.installerTests.machine")[0];
var config = machine.config;

jqUnit.module("Code tests");

/**
 * Install node on the guest (if this script is running on the host).
 */
gpii.installerTests.installNode = function () {
    if (gpii.installerTests.host) {
        // Install node
        var nodeVersion;
        try {
            var provisionScript = fs.readFileSync(config.gpiiAppDir + "/provisioning/Chocolatey.ps1", "utf8");
            var match = /\$nodeVersion\s+=\s+"([^"]+)"/.exec(provisionScript);
            nodeVersion = match && match[1];
        } catch (e) {
            nodeVersion = null;
        }
        if (!nodeVersion) {
            nodeVersion = "8.9.4";
        }
        machine.guestScript("scripts/chocolatey.bat");
        machine.execElevated("choco install nodejs.install --version " + nodeVersion + " --forcex86 -y");
    }
};

jqUnit.test("Code tests", function () {
    machine.saveSnapshot("before-code-tests");
    gpii.installerTests.installNode();

    var electron = config.shareDir + "\\node_modules\\.bin\\electron.cmd";
    var unitResult = machine.execUser(electron + " "
        + config.shareDir + "/node_modules/gpii-windows/tests/UnitTests.js");
    jqUnit.assertEquals("Windows unit tests should pass.", 0, unitResult.code);

    // var acceptanceResult = machine.execUser(electron + " "
    //     + config.shareDir + "/node_modules/gpii-windows/tests/AcceptanceTests.js");
    // jqUnit.assertEquals("Windows acceptance tests should pass.", 0, acceptanceResult.code);

    // Revert back to the state before node was installed.
    machine.restoreSnapshot("before-code-tests");
    machine.deleteSnapshot("before-code-tests");
});
