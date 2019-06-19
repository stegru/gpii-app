:: Installs the elevate command

set URL="https://github.com/stegru/elevate/releases/download/1.0.exe/elevate64.exe"
set DOWNLOAD="c:\windows\elevate.exe"

powershell -Command "(New-Object System.Net.WebClient).DownloadFile('%URL%', '%DOWNLOAD%')"

