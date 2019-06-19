:: Installs the 'refreshenv' command, from chocolatey.

set URL="https://raw.githubusercontent.com/chocolatey/chocolatey/master/src/redirects/RefreshEnv.cmd"
set DOWNLOAD="c:\windows\refreshenv.cmd"

if not exist "%DOWNLOAD%" (
    powershell -Command "(New-Object System.Net.WebClient).DownloadFile('%URL%', '%DOWNLOAD%')"
)
