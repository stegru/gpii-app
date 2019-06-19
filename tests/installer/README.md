# Installer Tests

Performs automated QA tests on an installer.

This can create, and perform tests in, the following environments:

* Current vagrant box.
* Fresh Windows 7, 8, 10, and 10 preview.
* Inside any Windows guest

The tests consist of:
* CI code tests
* Installer execution
* Keying in/out with various test users. Before and after screenshots are taken.

## Usage

This script can be invoked from either within a guest machine, or on a host. By running in a guest, you forfeit the
ability to creates and manipulate VMs.

Invocation:

    node ./index.js [OPTIONS]

#### Testing options

- `--msi FILE`
    Specify `FILE` as installer to use. "`none`" to assume Morphic is already installed. Default is to use the latest
    .msi file in `%gpii-app/installer` 

- `--codeTests`
    Perform the unit tests. (See below)

#### Environment creation options

(not available if running inside a guest)

- `--vm VM`
    Specifies the virtual machine to build/run. `VM` being one of the following:
    - `default`: The default virtual machine for gpii-app.
    - `windows7`, `windows8`, `windows10`, `windows10-preview`: Create (or reuse) a new virtual machine containing the
     relevant OS.

    If there's already a box installed, then it is powered up (`vagrant up`).

- `--iso FILE`
    The installation media. (see notes below)

- `--boxOnly`
    Create the vagrant box, but don't import or run it.

- `--installWindowsOnly`
    Create the VM, but don't create a vagrant box or perform any tests.

- `--skipUpdates`
    Don't perform any OS updates after installation.

- `--alwaysUpdate`
    Always perform updates when starting.

## Examples

To install and test a windows10 preview release:

     node index.js --vm windows10-preview --iso /mnt/slowdata/iso/Windows10_InsiderPreview_EnterpriseVL_x64_en-us_17758.iso




## Notes

### Windows Installation.

Using this script to create non-preview installations may not be necessary; This script should be able to be run inside
a standard inclusivedesign/windowsXX boxes.

When installing Windows, an iso image of the installation media is required. This is specified using the `--iso` option.
This only needs to be performed once (per OS), as the resulting box is imported into vagrant.

* `windows8` and `windows10` machines don't need it, the ISO downloaded automatically via packer.
* `windows10-preview` requires an ISO downloaded from [https://www.microsoft.com/en-us/software-download/windowsinsiderpreviewadvanced](https://www.microsoft.com/en-us/software-download/windowsinsiderpreviewadvanced) 
* `windows7` requires the retail ISO (the link for the evaluation ISO has gone).
If you already know the sha1 checksum, then supply it via --isoChecksum (or in a xxx.iso.sha1 file next to the iso).

### Code Tests

The unit and acceptance tests can be performed in the VM. Running the tests in a preview release of Windows is a quick
way to determine if there are any breaking changes. 

Unless using the gpii-app vagrant box (`--vm default`), node, npm and any other dependencies required for the tests will
be installed. As well as the tests, this will taint a fresh system, so a snapshot of the VM will be made. The VM will be
reverted back to the snapshot once the tests complete.

