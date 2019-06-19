"use strict";

var fluid = require("infusion"),
    path = require("path"),
    parseArgs = require("minimist"),
    fs = require("fs"),
    mkdirp = require("mkdirp"),
    shelljs = require("shelljs");

var gpii = fluid.registerNamespace("gpii");
gpii.installerTests = fluid.registerNamespace("gpii.installerTests");

gpii.installerTests.isGuest = (process.env.USERNAME === "vagrant" || fs.existsSync("c:/vagrant"));

fluid.contextAware.makeChecks({
    "gpii.contexts.guest": {
        value: gpii.installerTests.isGuest
    },
    "gpii.contexts.host": {
        value: !gpii.installerTests.isGuest
    }
});

if (gpii.installerTests.isGuest) {
    require("./guest.js");
} else {
    require("./host.js");
}

fluid.defaults("gpii.installerTests.machine", {
    gradeNames: ["fluid.component", "fluid.contextAware", "gpii.installerTests.machine.host"],
    contextAwareness: {
        platform: {
            checks: {
                guest: {
                    contextValue: "{gpii.contexts.guest}",
                    gradeNames: "gpii.installerTests.machine.guest"
                },
                host: {
                    contextValue: "{gpii.contexts.host}",
                    gradeNames: "gpii.installerTests.machine.host"
                }
            }
        }
    },
    invokers: {
        begin: "gpii.installerTests.begin({that})",
        startMachine: "fluid.notImplemented",
        startTests: "gpii.installerTests.startTests({that})",
        localShell: {
            funcName: "gpii.installerTests.localShell",
            args: ["{arguments}.0", "{arguments}.1"] // command, options
        },
        shell: "fluid.notImplemented",
        execUser: "fluid.notImplemented",
        execElevated: "fluid.notImplemented",
        guestScript: "fluid.notImplemented",
        saveSnapshot: "fluid.identity",
        restoreSnapshot: "fluid.identity",
        screenshot: {
            funcName: "gpii.installerTests.screenshot",
            args: ["{that}", "{arguments}"]
        },
        saveScreenImage: "fluid.notImplemented",
        shutdown: {
            funcName: "gpii.installerTests.shutdown",
            args: ["{that}", "{arguments}.0"] // success
        }
    },
    listeners: {
        onAllTestsDone: "{that}.shutdown({arguments}.0)"
    },
    events: {
        onAllTestsDone: null
    },
    members: {
        screenshotNumber: 0,
        config: {
            // Run the unit tests
            codeTests: false,
            // The installer to run (or get the latest from %gpii-app/installers)
            msi: null,
            // The gpii-app directory on the guest.
            shareDir: "c:/vagrant",
            // Location of gpii-app.
            gpiiAppDir: path.join(__dirname, "/../.."),
            // Where the reports are dumped
            reportDir: path.join(__dirname, "report")
        }
    }
});


// gpii.installerTests.shell = execObj.shell;
// gpii.installerTests.execUser = execObj.execUser;
// gpii.installerTests.execElevated = execObj.execElevated;
// gpii.installerTests.guestScript = execObj.guestScript;

/**
 * Raise a fatal error.
 */
gpii.installerTests.fatalError = function () {
    var err = new Error(fluid.makeArray(arguments).join(" "));
    err.fatalError = true;
    throw err;
};

/**
 * Reads options from the command line, and puts them in the config object.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 */
gpii.installerTests.readCommandLine = function (that) {
    var args = parseArgs(process.argv.slice(2));

    if (args.help) {
        // Spit out the default configuration and die.
        console.log("\n", process.argv.slice(0, 2).join(" "), "[OPTIONS]\n");
        fluid.each(that.config, function (value, key) {
            var pad = " ".repeat(Math.max(0, 20 - key.length));
            console.log("  ", "--" + key, pad, JSON.stringify(value));
        });
        process.exit(1);
    }

    that.config.args = args;

    // Read the command-line arguments onto the config.
    var knownConfigKeys = Object.keys(that.config);
    knownConfigKeys.push("_");
    that.config = Object.assign(that.config, args);

    // Check for unknown arguments
    var actualConfigKeys = Object.keys(that.config);
    if (actualConfigKeys.length > knownConfigKeys.length) {
        fluid.each(actualConfigKeys, function (key) {
            if (knownConfigKeys.indexOf(key) === -1) {
                gpii.installerTests.fatalError("Unknown command line option: --" + key);
            }
        });
    }

    // Check for required arguments
    fluid.each(that.config, function (value, key) {
        if (value === undefined || value === fluid.NO_VALUE) {
            gpii.installerTests.fatalError("Required command line option: --" + key);
        }
    });
};

/**
 * Synchronously execute a shell command, on the local machine (the machine this script is running on).
 *
 * @param {String|Array<String>} command The command line, or list of command arguments.
 * @param {Object} options [optional] Passed to shelljs.exec
 * @return {Object} shelljs.exec's return.
 */
gpii.installerTests.localShell = function (command, options) {
    var cmd;
    if (Array.isArray(command)) {
        var args = fluid.transform(command, gpii.installerTests.quoteShell);
        cmd = args.join(" ");
    } else {
        cmd = command;
    }

    var result;
    var cwd = process.cwd();
    try {
        if (options && options.cwd) {
            process.chdir(options.cwd);
            console.log("cwd: ", process.cwd());
        }
        console.log("exec: ", cmd);
        result = shelljs.exec(cmd, options);
    } finally {
        process.chdir(cwd);
    }

    if (!options || options.expectCode !== "ignore") {
        var expect = options && options.expectCode || 0;
        if (result.code !== expect) {
            fluid.fail("`" + command + "` failed with exit code " + result.code);
        }
    }
    return result;
};

/**
 * Surrounds a string with single quotes if it contains any non-safe characters, and escapes any quotes in the string.
 * input: It's quoted
 * output: 'It'\''s quoted'
 *
 * @param {String} arg The string to quote.
 * @return {String} The quoted string.
 */
gpii.installerTests.quoteShell = function (arg) {
    if (/[^a-z0-9_./@%:-]/i.test(arg)) {
        return "'" + arg.replace(/'/g, "'\\''") + "'";
    } else {
        return arg;
    }
};

/**
 * Take a screenshot of the guest.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String|Array|IArguments} args Name
 */
gpii.installerTests.screenshot = function (that, args) {
    that.screenshotNumber++;
    var name = ("000" + that.screenshotNumber).slice(-3) + "-" + fluid.makeArray(args).join(".");
    name = name.replace(/\s/g, "_");
    var imageFile = path.join(that.config.reportDir, name) + ".png";

    that.saveScreenImage(imageFile);
};


/**
 * Start the tests, called when the VM is ready,
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 */
gpii.installerTests.startTests = function (that) {
    that.saveSnapshot("start", true);
    require("./tests/all-tests.js");
};

/**
 * The entry point.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 */
gpii.installerTests.begin = function (that) {
    process.chdir(__dirname);

    gpii.installerTests.readCommandLine(that);

    if (that.config.installWindowsOnly || that.config.boxOnly) {
        // msi file is not required.
        that.config.msi = "none";
    }

    // Get the installer file
    if (that.config.msi === "none") {
        that.config.msi = null;
    } else if (!that.config.msi) {
        // Use the most recent installer file.
        var dir = that.config.gpiiAppDir + "/installer/";

        that.config.msi = shelljs.ls(dir + "*.msi").filter(function (f) {
            return dir + f;
        }).sort(function (a, b) {
            return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
        })[0];

        if (that.config.msi) {
            console.log("Using MSI file:", that.config.msi);
        } else {
            gpii.installerTests.fatalError("No installers found in %gpii-app/installer");
        }
    } else if (fs.existsSync(that.config.msi)) {
        if (!that.config.msi.startsWith(that.config.gpiiAppDir)) {
            gpii.installerTests.fatalError("The installer '" + that.config.msi
                + "' should be somewhere in the gpii-app directory, " + that.config.gpiiAppDir);
        }
    }

    that.config.reportDir = path.join(that.config.reportDir, that.config.vm + "-" + new Date().toISOString().replace(/:/g,""));
    mkdirp.sync(that.config.reportDir);

    var work = [];

    work.push(that.startMachine);

    if (!that.config.installWindowsOnly && !that.config.boxOnly) {
        work.push(that.startTests);
    }

    fluid.promise.sequence(work);
};

/**
 *
 */
gpii.installerTests.shutdown = function () {

};

gpii.installerTests.machine().begin();
