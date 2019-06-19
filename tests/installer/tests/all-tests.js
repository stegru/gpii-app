"use strict";

var fluid = require("infusion"),
    jqUnit = fluid.require("node-jqunit");

var gpii = fluid.registerNamespace("gpii");
gpii.installerTests = fluid.registerNamespace("gpii.installerTests");

var machine = fluid.queryIoCSelector(fluid.rootComponent, "gpii.installerTests.machine")[0];

jqUnit.onAllTestsDone.addListener(function (results) {
    machine.events.onAllTestsDone.fire(results.failed === 0);
});

if (machine.config.codeTests) {
    require("./code.js");
} else {
    console.log("Skipping code tests. Use --codeTests to run them.");
}

if (machine.config.msi) {
    require("./installer.js");
} else {
    console.log("Not running installer tests.");
}

require("./user.js");
