# Copies the skills from this repo into your personal Claude skills folder
# (%USERPROFILE%\.claude\skills), so they work in any folder.
# Run it again any time you change a skill here.

$dest = Join-Path $HOME ".claude\skills"
New-Item -ItemType Directory -Force $dest | Out-Null

Get-ChildItem (Join-Path $PSScriptRoot "skills") -Directory | ForEach-Object {
    $target = Join-Path $dest $_.Name
    if (Test-Path $target) { Remove-Item $target -Recurse -Force }
    Copy-Item $_.FullName -Destination $target -Recurse
    Write-Host "Installed $($_.Name)"
}

Write-Host "Done. Start a new Claude session to pick up the changes."
