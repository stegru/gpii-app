:: Installs the Microsoft Visual C++ Redistributable, for doit to work.


set URL="https://aka.ms/vs/15/release/vc_redist.x86.exe"
set DOWNLOAD="c:\windows\temp\vc_redist.x86.exe"

powershell -Command "(New-Object System.Net.WebClient).DownloadFile('%URL%', '%DOWNLOAD%')"

%DOWNLOAD% /silent
