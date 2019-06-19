"use strict";

var fluid = require("infusion"),
    request = require("request"),
    path = require("path"),
    fs = require("fs"),
    mkdirp = require("mkdirp");

var gpii = fluid.registerNamespace("gpii");

if (!gpii.installerTests.isGuest) {
    fluid.fail("Only run this on the guest");
}

gpii.installerTests.guest = fluid.registerNamespace("gpii.installerTests.guest");

fluid.defaults("gpii.installerTests.machine.guest", {
    gradeNames: ["fluid.component"],
    invokers: {
        startMachine: "gpii.installerTests.guest.init({that})",
        // Execute an elevated shell command on the guest (as 'system' user, no desktop interaction).
        shell: {
            funcName: "gpii.installerTests.guest.shell",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // (command, options)
        },
        // Execute a shell command on the guest, in the context of the desktop user.
        execUser: {
            funcName: "gpii.installerTests.guest.execUser",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // (command, options)
        },
        // Start an executable on the guest, in the context the desktop user with elevated privileges.
        execElevated: {
            funcName: "gpii.installerTests.guest.execElevated",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // (command, options)
        },
        // Execute an elevated script on the guest.
        guestScript: {
            funcName: "gpii.installerTests.guest.guestScript",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // (file, options)
        },
        // no-ops
        saveSnapshot: "fluid.identity",
        restoreSnapshot: "fluid.identity",
        deleteSnapshot: "fluid.identity",
        saveScreenImage: {
            funcName: "gpii.installerTests.guest.saveScreenImage",
            args: ["{that}", "{arguments}.0"] // (image file)
        }
    },
    members: {
        config: {}
    }
});


/**
 * Initialise the guest.
 *
 * Installs the `elevate` command, to allow the doit command to run things elevated.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 * @return {Promise} Resolves when complete.
 */
gpii.installerTests.guest.init = function (that) {
    var promise = fluid.promise();

    // Download elevate.exe
    var binPath = path.join(__dirname, ".bin");
    mkdirp.sync(binPath);
    process.env.PATH = binPath + ";" + process.env.PATH;

    var file = path.join(binPath, "elevate.exe");

    if (fs.existsSync(file)) {
        promise.resolve();
    } else {
        var output = fs.createWriteStream(file);

        console.log("Getting elevate.exe...");

        var req = request("https://github.com/stegru/elevate/releases/download/1.0.exe/elevate64.exe").pipe(output);
        output.on("finish", function () {
            output.close(promise.resolve);
            console.log("Got it");
        });

        req.on("error", function (err) {
            console.error(err);
            fs.unlinkSync(file);
            promise.reject(err);
        });
    }
    return promise;
};

/**
 * Saves a screenshot of the vm.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String} imageFile The image destination file.
 */
gpii.installerTests.guest.saveScreenImage = function (that, imageFile) {
    that.localShell(["powershell", "-ExecutionPolicy", "ByPass", "./scripts/screenshot.ps1", imageFile]);
};


/**
 * Execute an elevated shell command on the guest (as 'system' user, no desktop interaction).
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String} command Command
 * @param {Object} options Options
 * @param {String|Number} options.expectCode The exit code to expect, otherwise throw an exception. "ignore" to ignore.
 * @return {Object} Exit code and text output.
 */
gpii.installerTests.guest.shell = function (that, command, options) {
    return that.localShell("psexec.exe -accepteula -nobanner -s powershell.exe -Command " +
        gpii.installerTests.quoteShell(command), options);
};

/**
 * Execute a shell command on the guest, in the context of the desktop user.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String} command Command
 * @param {Object} options Options
 * @param {String|Number} options.expectCode The exit code to expect, otherwise throw an exception. "ignore" to ignore.
 * @return {Object} Exit code and text output.
 */
gpii.installerTests.guest.execUser = function (that, command, options) {
    // Run it through do.ps1, like the host would.
    return that.localShell("powershell do.ps1 -c " + gpii.installerTests.quoteShell(command), options);
};

/**
 * Start an executable on the guest, in the context the desktop user with elevated privileges.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String} command Command
 * @param {Object} options Options
 * @param {String|Number} options.expectCode The exit code to expect, otherwise throw an exception. "ignore" to ignore.
 * @return {Object} Exit code and text output.
 */
gpii.installerTests.guest.execElevated = function (that, command, options) {
    var elevate = path.join(__dirname, ".bin", "elevate.exe");
    return that.execUser(elevate + " -wait " + command, options);
};

/**
 * Execute an elevated script on the guest.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String} file The file, on the host. This will be uploaded to a temporary location.
 * @param {Object} options Options
 * @param {String|Number} options.expectCode The exit code to expect, otherwise throw an exception. "ignore" to ignore.
 * @return {Object} Exit code and text output.
 */
gpii.installerTests.guest.guestScript = function (that, file, options) {
    return that.exec(file, options);
};
