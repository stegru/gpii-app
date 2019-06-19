# Packer files

The content of this directory is used to modify the packer build provided by [github/idi-ops/packer-windows](https://github.com/idi-ops/packer-windows).

## Packer Templates

* [windows7.json](./windows7.json)
* [windows8.json](./windows8.json)
* [windows10.json](./windows10.json)
* [windows10-preview.json](./windows10-preview.json)

These have been taken from the corresponding 64-bit no apps build instructions (eg windows_10_64.json). They have been
modified slightly to build a lot faster and the minimal amount of change to a fresh OS install.

These templates contain the following changes, from the standard inclusivedesign/windowsXX boxes:
 * No space optimisation (like defrag and zeroing).
 * No chocolatey.
 * No development applications or libraries.

As such, the resulting .box files are not intended to be deployed beyond the tests for which they where indented.

## Scripts

These scripts (in addition to those in `packer-windows`) are invoked by packer.

* [install-elevate.bat](./scripts/install-elevate.bat) - Installs the `elevate` command (sort of a `sudo` command)
* [install-refreshenv.bat](./scripts/install-refreshenv.bat) - Downloads the `refreshenv` command from chocolatey
* [install-vcrt.bat](./scripts/install-vcrt.bat) - Visual C++ runtime (required by doit).
* [vm-guest-tools.bat](./scripts/vm-guest-tools.bat) - Installs virtualbox additions via mounted iso image.
