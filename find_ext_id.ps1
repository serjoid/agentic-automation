$path = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Preferences"
if (-not (Test-Path $path)) { Write-Output "Preferences not found at: $path"; exit }
$raw = Get-Content -Raw -Path $path
$prefs = $raw | ConvertFrom-Json
$exts = $prefs.extensions.settings.PSObject.Properties
$found = @()
foreach ($e in $exts) {
    $extPath = $e.Value.path
    if ($extPath -and ($extPath -like '*extension*' -or $extPath -like '*projetos*')) {
        $found += ($e.Name + ' | ' + $extPath)
    }
}
if ($found.Count -eq 0) {
    Write-Output "No matching extension found. Listing all unpacked extensions:"
    foreach ($e in $exts) {
        if ($e.Value.location -eq 4) {
            Write-Output ($e.Name + ' | ' + $e.Value.path)
        }
    }
} else {
    $found | ForEach-Object { Write-Output $_ }
}
