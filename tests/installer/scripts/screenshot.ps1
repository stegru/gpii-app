# Take a screenshot
#

param(
    [Parameter(Mandatory = $true)]
    [string] $filename
)

$cs = @"
[DllImport("user32.dll")]
public static extern int GetSystemMetrics(int smIndex);
"@

$winapi = Add-Type -MemberDefinition $cs -Name gsm -PassThru

$SM_CXSCREEN = 0
$SM_CYSCREEN = 1
$width = $winapi::GetSystemMetrics($SM_CXSCREEN);
$height = $winapi::GetSystemMetrics($SM_CYSCREEN);

[Reflection.Assembly]::LoadWithPartialName("System.Drawing")
$bmp = [System.Drawing.Bitmap]::new($width, $height)
$size = [System.Drawing.Size]::new($width, $height)

$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen([System.Drawing.Point]::Empty, [System.Drawing.Point]::Empty, $size)
$bmp.Save($filename, [System.Drawing.Imaging.ImageFormat]::Png)

$xcs = @"

namespace Screenshot
{
    using System;
    using System.Drawing;
    using System.Runtime.InteropServices;

    public class Screenshot
    {
        private const int SM_CXSCREEN = 0;
        private const int SM_CYSCREEN = 1;

        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int smIndex);

        public static void Cheese(string filename)
        {
            int width = GetSystemMetrics(SM_CXSCREEN);
            int height = GetSystemMetrics(SM_CYSCREEN);

            using (System.Drawing.Bitmap bmp = new Bitmap(width, height)) {
                using (Graphics g = Graphics.FromImage(bmp))
                {
                    g.CopyFromScreen(Point.Empty, Point.Empty, new Size(width, height));
                }
                bmp.Save(filename, System.Drawing.Imaging.ImageFormat.Png);
            }
        }
    }
}
"@

