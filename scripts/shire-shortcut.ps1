param([switch]$Desktop)
$ErrorActionPreference='Stop'
$shireRepo=Split-Path $PSScriptRoot -Parent
$shireIcon=Join-Path $shireRepo 'front\public\shire\icons\shire.ico'
$shireLauncher=Join-Path $shireRepo 'scripts\shire-local.ps1'
if(-not(Test-Path -LiteralPath $shireIcon)){throw 'The Shire icon package is missing. Prepare its assets first.'}
$shireDestination=if($Desktop){[Environment]::GetFolderPath('Desktop')}else{$shireRepo}
$shireShortcutPath=Join-Path $shireDestination 'The Shire.lnk'
$shireShell=New-Object -ComObject WScript.Shell
if(Test-Path -LiteralPath $shireShortcutPath){
  $shireExisting=$shireShell.CreateShortcut($shireShortcutPath)
  if(-not $shireExisting.Arguments.Contains($shireLauncher)){throw 'A different shortcut already has this name. It was preserved.'}
}
$shireShortcut=$shireShell.CreateShortcut($shireShortcutPath)
$shireShortcut.TargetPath=Join-Path $PSHOME 'powershell.exe'
if(-not(Test-Path -LiteralPath $shireShortcut.TargetPath)){$shireShortcut.TargetPath=(Get-Command powershell.exe -ErrorAction Stop).Source}
$shireShortcut.Arguments='-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$shireLauncher+'" -Mode Start -OpenBrowser'
$shireShortcut.WorkingDirectory=$shireRepo
$shireShortcut.IconLocation=$shireIcon+',0'
$shireShortcut.Description='The Shire — a place to call home. Local worlds on E:.'
$shireShortcut.WindowStyle=7
$shireShortcut.Save()
Write-Output $shireShortcutPath
