"use strict";

var fluid = require("infusion"),
    shelljs = require("shelljs"),
    fs = require("fs"),
    path = require("path");

var gpii = fluid.registerNamespace("gpii");
gpii.installerTests = fluid.registerNamespace("gpii.installerTests");

if (gpii.installerTests.isGuest) {
    fluid.fail("Only run this on the host");
}

gpii.installerTests.host = fluid.registerNamespace("gpii.installerTests.host");

fluid.defaults("gpii.installerTests.machine.host", {
    gradeNames: ["fluid.component"],
    invokers: {
        startMachine: "gpii.installerTests.host.startMachine({that})",
        // Execute an elevated shell command on the guest (as 'system' user, no desktop interaction).
        shell: {
            funcName: "gpii.installerTests.host.shell",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // (command, options)
        },
        // Execute a shell command on the guest, in the context of the desktop user.
        execUser: {
            funcName: "gpii.installerTests.host.execUser",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // (command, options)
        },
        // Start an executable on the guest, in the context the desktop user with elevated privileges.
        execElevated: {
            funcName: "gpii.installerTests.host.execElevated",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // (command, options)
        },
        // Execute an elevated script on the guest.
        guestScript: {
            funcName: "gpii.installerTests.host.guestScript",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // (file, options)
        },
        saveSnapshot: {
            funcName: "gpii.installerTests.host.saveSnapshot",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // (snapshot name, overwrite)
        },
        restoreSnapshot: {
            funcName: "gpii.installerTests.host.restoreSnapshot",
            args: ["{that}", "{arguments}.0"] // (snapshot name)
        },
        deleteSnapshot: {
            funcName: "gpii.installerTests.host.deleteSnapshot",
            args: ["{that}", "{arguments}.0"] // (snapshot name)
        },
        saveScreenImage: {
            funcName: "gpii.installerTests.host.saveScreenImage",
            args: ["{that}", "{arguments}.0"] // (image file)
        }
    },
    members: {
        config: {
            // The VM name
            vm: fluid.NO_VALUE,
            buildDir: path.join(__dirname, "./build"),
            // The windows installation DVD.
            iso: null,
            isoChecksum: null,
            // Set to use the iso even if the packer file has one.
            isoForce: false,
            // Just create the vagrant box
            boxOnly: false,
            // existing vagrant.
            vagrantFile: null,
            // `vboxmanage` executable.
            vboxManage: "vboxmanage",
            // Where to get the packer files.
            packerRepo: "https://github.com/idi-ops/packer-windows.git",
            packerRepoBranch: "master",
            // Don't perform windows updates after OS installation.
            skipUpdates: false,
            // Always perform windows updates on vagrant up.
            alwaysUpdate: false,
            // With --iso, stop when Windows has installed
            installWindowsOnly: false,
            // What to prepend to the VM snapshot names.
            snapshotPrefix: "installer-tests."
        }
    }
});


/**
 * Gets the SHA1 hash of a file. Will attempt first to get the value from a file with ".sha1" appended to the name.
 *
 * @param {String} file The file of which to get the hash.
 * @return {Promise} Resolves with the hex-string sha1 hash.
 */
gpii.installerTests.host.getFileChecksum = function (file) {
    var promise = fluid.promise();

    try {
        var hashFile = file + ".sha1";
        if (!fs.existsSync(hashFile)) {
            hashFile = file + ".SHA1";
        }
        promise.resolve(fs.readFileSync(hashFile, "utf8").trim());
        console.log("Used", hashFile);
    } catch (e) {
        if (e.code === "ENOENT") {
            console.log("Calculating sha1 of", file);
            var crypto = require("crypto");
            var hash = crypto.createHash("sha1");
            var input = fs.createReadStream(file);
            input.on("end", function () {
                hash.end();
                promise.resolve(hash.read().toString("hex"));
            });
            input.pipe(hash);
        } else {
            promise.reject(e);
        }
    }

    return promise.then(function (result) {
        console.log(file, "sha1:", result);
    });
};

/**
 * Build the virtual machine, using packer.
 * @param {Component} that The gpii.installerTests.machine instance.
 */
gpii.installerTests.host.buildVM = function (that) {
    that.config.box = path.join(that.config.buildDir, that.config.vm + ".box");

    if (fs.existsSync(that.config.box)) {
        console.log("Using existing box:", that.config.box);
        return;
    }

    if (!shelljs.which("packer")) {
        fluid.fail("packer is required to build the VM.");
    }

    var packerDir = path.join(that.config.buildDir, "packer-windows");

    if (fs.existsSync(packerDir)) {
        console.log("Using current packer files at", packerDir);
    } else {
        // Clone windows-packer.
        that.localShell(["git", "clone", that.config.packerRepo, "--branch", that.config.packerRepoBranch, packerDir]);
    }

    // Make some adjustments windows-packer.
    shelljs.cp("-rf", "packer/answer_files", packerDir);
    shelljs.cp("-rf", "packer/scripts", packerDir);
    shelljs.rm("-rf", path.join(packerDir, "doit", "client"));
    shelljs.rm("-rf", path.join(packerDir, "doit", "server"));

    // Create the packer template.
    that.config.packerFile = "./packer/" + that.config.vm + ".json";
    if (!fs.existsSync(that.config.packerFile)) {
        gpii.installerTests.fatalError("No packer file for " + that.config.vm);
    }
    var template = require(that.config.packerFile);

    if (that.config.installWindowsOnly) {
        // Remove post-processors - not creating a box.
        delete template["post-processors"];
    }

    if (that.config.iso) {
        template.variables.iso_url = that.config.iso;
        if (that.config.isoChecksum) {
            template.variables.iso_checksum = that.config.isoChecksum;
            template.variables.iso_checksum_type = "sha1";
        }
    }
    if (!template.variables.iso_url) {
        gpii.installerTests.fatalError("This packer file requires an iso image, with the --iso option.");
    }

    template.variables.vm_only = that.config.installWindowsOnly ? "true" : "false";
    template.variables.vm_product = that.config.vm;
    template.variables.box_file = that.config.box;
    template.variables.builder_dir = path.join(that.config.buildDir, that.config.vm);

    // Write it.
    var templateFilename = path.join(that.config.buildDir, that.config.vm + ".build");
    fs.writeFileSync(templateFilename, JSON.stringify(template, null, 2));

    that.config.cleanup.push(templateFilename);
    that.config.cleanup.push(that.config.box);
    that.config.cleanup.push(that.config.box + "-winver.txt");

    // Run packer
    that.localShell(["packer", "build", "-only=virtualbox-iso", templateFilename], {cwd: packerDir});
};

/**
 * Installs the vagrant box, created by packer.
 * @param {Component} that The gpii.installerTests.machine instance.
 */
gpii.installerTests.host.installBox = function (that) {
    if (!that.config.boxVersion) {
        var match;
        try {
            match = /\[Version ([0-9.]+)]/.exec(fs.readFileSync(that.config.box + "-winver.txt"));
        } catch (e) {
            match = null;
        }

        that.config.boxVersion = match ? match[1] : "0";
    }

    var boxInfo = {
        name: that.config.vm,
        versions: [{
            version: that.config.boxVersion,
            providers: [{
                name: "virtualbox",
                url: that.config.box
            }]
        }]
    };

    var boxJson = that.config.box + ".json";
    fs.writeFileSync(boxJson, JSON.stringify(boxInfo));
    that.config.cleanup.push(boxInfo);

    that.localShell(["vagrant", "box", "add", boxJson, "--force"]);
};

/**
 * Invokes `vagrant up`.
 * @param {Component} that The gpii.installerTests.machine instance.
 * @return {Promise} Resolves when the box is up.
 */
gpii.installerTests.host.vagrantUp = function (that) {
    that.localShell(["vagrant", "up", that.config.vm]);
    var dotVagrantLocation = (that.config.vm === "default") ? that.config.gpiiAppDir : ".";
    that.config.vmId = fs.readFileSync(dotVagrantLocation + "/.vagrant/machines/" + that.config.vm + "/virtualbox/id", "utf8").trim();
    var promise = fluid.promise();
    process.nextTick(promise.resolve);
    return promise;
};

/**
 * Execute an elevated shell command on the guest (as 'system' user, no desktop interaction).
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String} command Command
 * @param {Object} options Options
 * @param {String|Number} options.expectCode The exit code to expect, otherwise throw an exception. "ignore" to ignore.
 * @return {Object} Exit code and text output.
 */
gpii.installerTests.host.shell = function (that, command, options) {
    return that.localShell(["vagrant", "winrm", "-e", "-c", command, that.config.vm], options);
};

/**
 * Execute a shell command on the guest, in the context of the desktop user.
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String} command Command
 * @param {Object} options Options
 * @param {String|Number} options.expectCode The exit code to expect, otherwise throw an exception. "ignore" to ignore.
 * @return {Object} Exit code and text output.
 */
gpii.installerTests.host.execUser = function (that, command, options) {
    var args = "do.ps1 -c " + gpii.installerTests.quoteShell(command);
    return that.localShell(["vagrant", "winrm", "-e", "-c", args, that.config.vm], options);
};

/**
 * Start an executable on the guest, in the context the desktop user with elevated privileges.
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String} command Command
 * @param {Object} options Options
 * @param {String|Number} options.expectCode The exit code to expect, otherwise throw an exception. "ignore" to ignore.
 * @return {Object} Exit code and text output.
 */
gpii.installerTests.host.execElevated = function (that, command, options) {
    return that.execUser("elevate -wait " + command, options);
};

/**
 * Execute an elevated script on the guest.
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String} file The file, on the host. This will be uploaded to a temporary location.
 * @param {Object} options Options
 * @param {String|Number} options.expectCode The exit code to expect, otherwise throw an exception. "ignore" to ignore.
 * @return {Object} Exit code and text output.
 */
gpii.installerTests.host.guestScript = function (that, file, options) {
    var remotePath = that.localShell(["vagrant", "winrm-upload", "-t", file, that.config.vm], {expectCode: "ignore"}).stdout;
    if (!remotePath) {
        gpii.installerTests.fatalError("Error uploading script to guest");
    }
    return that.shell(remotePath, options);
};

/**
 * Checks for and installs Windows updates. This may restart the guest.

 * @param {Component} that The gpii.installerTests.machine instance.
 * @return {Promise} Resolves when complete.
 */
gpii.installerTests.host.windowsUpdates = function (that) {
    var promise = fluid.promise();
    if (that.config.skipUpdates) {
        promise.resolve();
    } else {
        var output = that.guestScript("./scripts/win-updates.ps1").stdout;
        if (output.indexOf("#!Restart") >= 0) {
            console.log("Guest wants to restart");
            that.localShell(["vagrant", "reload", that.config.vm]);
            fluid.promise.follow(gpii.installerTests.host.windowsUpdates(that), promise);
        } else {
            promise.resolve();
        }
    }
    return promise;
};

/**
 * Saves a snapshot of the vm. If there's already a snapshot with the given name, then it is deleted first.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String} name Snapshot name
 * @param {Boolean} restore true to restore to an existing snapshot, if it exists.
 */
gpii.installerTests.host.saveSnapshot = function (that, name, restore) {
    // Check if it's already created
    var fullName = that.config.snapshotPrefix + name;
    var all = gpii.installerTests.host.listSnapshots(that);
    var exists = all.indexOf(name) > -1;

    if (exists && restore) {
        that.restoreSnapshot(name);
    } else {
        if (exists) {
            that.deleteSnapshot(name);
        }
        that.localShell(["vagrant", "snapshot", "save", that.config.vm, fullName]);
    }
};

/**
 * Gets the snapshots of the vm that have been created by this script (current and previous invocations)
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 */
gpii.installerTests.host.listSnapshots = function (that) {
    var resultText = that.localShell(["vagrant", "snapshot", "list", that.config.vm, "--machine-readable"]);
    var result = gpii.installerTests.host.parseVagrant(resultText);
    var togo = [];
    var all = fluid.makeArray(fluid.get(result, [that.config.vm, "ui" ,"output"]));
    fluid.each(all, function (name) {
        if (name.startsWith(that.config.snapshotPrefix)) {
            togo.push(name.substr(that.config.snapshotPrefix.length));
        }
    });

    return togo;
};

/**
 * Restores a snapshot of the vm.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String} name Snapshot name
 */
gpii.installerTests.host.restoreSnapshot = function (that, name) {
    var fullName = that.config.snapshotPrefix + name;
    that.localShell(["vagrant", "snapshot", "restore", that.config.vm, fullName]);
};

/**
 * Remove a snapshot from the vm.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String} name Snapshot name
 */
gpii.installerTests.host.deleteSnapshot = function (that, name) {
    var fullName = that.config.snapshotPrefix + name;
    that.localShell(["vagrant", "snapshot", "delete", that.config.vm, fullName]);
};

/**
 * Saves a screenshot of the vm.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 * @param {String} imageFile The image destination file.
 */
gpii.installerTests.host.saveScreenImage = function (that, imageFile) {
    that.localShell([that.config.vboxManage, "controlvm", that.config.vmId, "screenshotpng", imageFile]);
};

/**
 * Parses the machine readable output of vagrant
 * @param {String} vagrantOutput The output of a `vagrant` command, with the `--machine-readable` option.
 * @return {Object} Object containing the parsed data.
 */
gpii.installerTests.host.parseVagrant = function (vagrantOutput) {
    var togo = {};

    var arrayIndex = 0;
    fluid.each(vagrantOutput.split(/[\r\n]+/), function (line) {
        var fields = line.split(",");
        if (fields.length > 1) {
            // ignore timestamp
            fields.shift();
            if (fields[0] === "") {
                if (togo[arrayIndex] && togo[arrayIndex][fields[1]]) {
                    arrayIndex++;
                }
                fields[0] = arrayIndex;
            }
            // last is the value
            var value = fields.pop();
            var oldValue = fluid.get(togo, fields);
            if (oldValue) {
                oldValue = fluid.makeArray(oldValue);
                oldValue.push(value);
                fluid.set(togo, fields, oldValue);
            } else {
                fluid.set(togo, fields, value);
            }
        }
    });
    return togo;

};

/**
 * Gets the current vagrant box state, from `vagrant status`.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 * @return {String} The state.
 */
gpii.installerTests.host.getVMState = function (that) {
    var result = that.localShell(["vagrant", "status", that.config.vm, "--machine-readable"], {silent:true});
    var data = gpii.installerTests.host.parseVagrant(result.stdout);
    return data[that.config.vm] && data[that.config.vm].state;
};

/**
 * Starts the VM.
 *
 * If the VM does not exist, then it is created.
 *
 * @param {Component} that The gpii.installerTests.machine instance.
 * @return {Promise} Resolves when the box is up and running.
 */
gpii.installerTests.host.startMachine = function (that) {
    var work = [];
    that.config.cleanup = [];

    if (that.config.vm === "default") {
        that.config.replaceBox = false;
    } else {
        process.env.VAGRANT_VAGRANTFILE = path.join(__dirname, "Vagrantfile.tests");
    }

    process.env.VAGRANT_WINPTY_DISABLE = 1;
    process.env.VAGRANT_CWD = __dirname;

    var vmState = gpii.installerTests.host.getVMState(that);
    var created = vmState !== "not_created";

    if (created) {
        console.log("Virtual machine", that.config.vm, "is already created.");
    } else {

        shelljs.mkdir("-p", that.config.buildDir);

        var boxInstalled = false;

        if (!that.config.replaceBox) {
            // See if the box is already installed
            var result = that.localShell(["vagrant", "box", "list", "--machine-readable"], {silent:true});
            var boxes = gpii.installerTests.host.parseVagrant(result.stdout);

            fluid.each(boxes, function (boxInfo) {
                if (boxInfo["box-name"] === that.config.vm) {
                    boxInstalled = true;
                    console.log("Vagrant already has a box for", that.config.vm, " (use --replaceBox to override)");
                }
            });
        }

        if (!boxInstalled) {
            if (that.config.iso) {
                if (!that.config.isoChecksum) {
                    var p = gpii.installerTests.host.getFileChecksum(that.config.iso).then(function (result) {
                        that.config.isoChecksum = result;
                    });

                    work.push(p);
                }
            }

            work.push(gpii.installerTests.host.buildVM);

            if (!that.config.installWindowsOnly) {
                work.push(gpii.installerTests.host.installBox);
            }
        }
    }

    if (!that.config.installWindowsOnly && !that.config.boxOnly) {
        // Start the VM
        work.push(gpii.installerTests.host.vagrantUp);
        if (that.config.alwaysUpdate || !created) {
            work.push(gpii.installerTests.host.windowsUpdates);
        }
    }
    return fluid.promise.sequence(work, that);
};
