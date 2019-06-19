#
# Fakes a USB insert/removal - tickles GPII in the correct way to make it think a USB key has been inserted or
# removed.
#
# Usage:
#  usb-key.ps1 TOKEN [DRIVE-LETTER] [-Remove]
#
#    TOKEN          The gpii key.
#    DRIVE-LETTER   The drive letter to mount the usb (optional, default 'N')
#    -Remove        Remove the fake USB drive.
#

param(
    [Parameter(Mandatory = $true, Position = 1)]
    [string] $token,
    [Parameter(Position = 2)]
    [switch] $remove,
    [string] $drive = "n"
)
$cs = @"
namespace FakeUsb
{
    using System.Runtime.InteropServices;
    using System.Text;

    public class FakeUsb
    {
        private const int WM_DEVICECHANGE = 0x219;
        private const int DBT_DEVICEARRIVAL = 0x8000;
        private const int DBT_DEVICEREMOVECOMPLETE = 0x8004;
        private const int DBT_DEVTYP_VOLUME = 0x2;
        private const int DBTF_NET = 0x2;
        private const int HWND_BROADCAST = 0xffff;

        [StructLayout(LayoutKind.Sequential)]
        private struct DEV_BROADCAST_VOLUME
        {
            public int size;
            public int deviceType;
            public int reserved;
            public int unitmask;
            public int flags;
        }

        [DllImport("user32.dll")]
        private static extern int SendMessage(int hWnd, int hMsg, int wParam, ref DEV_BROADCAST_VOLUME lParam);

        public static void SendNotification(string driveLetter, bool addDevice)
        {
            string drive = driveLetter.Substring(0, 1).ToUpper();

            DEV_BROADCAST_VOLUME volume = new DEV_BROADCAST_VOLUME();
            volume.size = Marshal.SizeOf(volume.GetType());
            volume.deviceType = DBT_DEVTYP_VOLUME;
            volume.flags = 0;

            // Each bit represents a drive letter.
            int bit = Encoding.ASCII.GetBytes(drive)[0] - 0x41;
            volume.unitmask = 1 << bit;

            SendMessage(0xffff, WM_DEVICECHANGE, addDevice ? DBT_DEVICEARRIVAL : DBT_DEVICEREMOVECOMPLETE, ref volume);
        }
    }
}
"@

$drive = $drive[0]
$dir = "$env:TEMP\FakeUsb\$drive"

if ($remove) {
    subst /d "${drive}:"
    Remove-Item -Recurse -Force $dir
} else {
    mkdir $dir | Out-Null
    Set-Content -Value $token $dir/.gpii-user-token.txt
    subst "${drive}:" $dir
}

Add-Type -TypeDefinition $cs -Language CSharp
[FakeUsb.FakeUsb]::SendNotification($drive, !$remove)
