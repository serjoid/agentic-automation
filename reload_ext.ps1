Add-Type -AssemblyName System.Windows.Forms

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

# Bring Chrome to foreground
$chrome = Get-Process chrome -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowTitle -ne "" } |
    Select-Object -First 1

if ($chrome) {
    [WinAPI]::ShowWindow($chrome.MainWindowHandle, 9)
    [WinAPI]::SetForegroundWindow($chrome.MainWindowHandle)
    Start-Sleep -Milliseconds 400
} else {
    Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe"
    Start-Sleep -Milliseconds 1500
    $chrome = Get-Process chrome | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object -First 1
    [WinAPI]::SetForegroundWindow($chrome.MainWindowHandle)
}

# Open chrome://extensions in address bar
[System.Windows.Forms.SendKeys]::SendWait("^l")
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait("chrome://extensions")
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 2500

Write-Output "OK"
