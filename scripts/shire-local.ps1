param(
  [ValidateSet('Prepare','Build','Start','Stop','Status')][string]$Mode='Start',
  [string]$DataRoot='E:\GrudgeBloxData\TheMiddleEarth',
  [ValidateRange(1024,65535)][int]$Port=4100,
  [switch]$OpenBrowser
)
$ErrorActionPreference='Stop'
$shireRepo=Split-Path $PSScriptRoot -Parent
$shireFront=Join-Path $shireRepo 'front'
$shireRoot=[System.IO.Path]::GetFullPath($DataRoot)
if($shireRoot -notmatch '^E:\\' -or -not (Test-Path -LiteralPath 'E:\')) { throw 'The configured E: storage is unavailable. No alternate drive will be used.' }
$shireLockHash=[System.Security.Cryptography.SHA256]::Create()
$shireLockKey=([BitConverter]::ToString($shireLockHash.ComputeHash([Text.Encoding]::UTF8.GetBytes($shireRoot.TrimEnd('\').ToLowerInvariant())))).Replace('-','')
$shireLockHash.Dispose()
$shireLaunchMutex=[System.Threading.Mutex]::new($false,"Local\GrudgeBloxShire_$shireLockKey")
$shireLockHeld=$false
try {
  try {$shireLockHeld=$shireLaunchMutex.WaitOne(0)} catch [System.Threading.AbandonedMutexException] {$shireLockHeld=$true}
  if(-not $shireLockHeld){throw 'This save folder already has a launcher operation in progress. Wait for it to finish.'}
$shireNode=(Get-Command node.exe -ErrorAction Stop).Source
$shireNext=Join-Path $shireFront 'node_modules\next\dist\bin\next'
$shireLedger=Join-Path $shireRoot 'cache\local-server.json'
if($Mode -eq 'Stop') {
  if(-not (Test-Path -LiteralPath $shireLedger)){ Write-Output 'No owned Shire server is recorded.'; exit 0 }
  $shireRecord=Get-Content -LiteralPath $shireLedger -Raw | ConvertFrom-Json
  $shireProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($shireRecord.processId)"
  if($shireProcess){
    if($shireProcess.Name -ne 'node.exe' -or -not $shireProcess.CommandLine.Contains($shireNext) -or -not $shireProcess.CommandLine.Contains('127.0.0.1')){throw 'The recorded process no longer matches this launcher. It was left running.'}
    Stop-Process -Id $shireRecord.processId
  }
  Remove-Item -LiteralPath $shireLedger
  Write-Output 'The owned Shire server has stopped. Saved worlds remain on E:.'
  exit 0
}
if($Mode -eq 'Status') {
  if(Test-Path -LiteralPath $shireLedger){Get-Content -LiteralPath $shireLedger}else{Write-Output 'No owned Shire server is recorded.'}
  exit 0
}
foreach($shireFolder in @('assets','saves','cache','cache\temp','cache\node-compile','builds','builds\next','evidence')){
  New-Item -ItemType Directory -Path (Join-Path $shireRoot $shireFolder) -Force | Out-Null
}
$shireVolume=Get-Volume -DriveLetter E
if($shireVolume.SizeRemaining -lt 1GB){throw 'At least 1 GB free on E: is required to build and run this local world.'}
$shireLink=Join-Path $shireFront '.shire-next'
$shireOutput=Join-Path $shireRoot 'builds\next'
if(Test-Path -LiteralPath $shireLink){
  $shireItem=Get-Item -LiteralPath $shireLink -Force
  if($shireItem.LinkType -ne 'Junction' -or [System.IO.Path]::GetFullPath([string]$shireItem.Target) -ne $shireOutput){throw 'The Shire build path already exists with a different destination. It was preserved.'}
}else{New-Item -ItemType Junction -Path $shireLink -Target $shireOutput | Out-Null}
$env:GRUDGE_LOCAL_WORLD='shire'
$env:GRUDGE_SHIRE_DATA_ROOT=$shireRoot
$env:NEXT_TELEMETRY_DISABLED='1'
$env:TEMP=Join-Path $shireRoot 'cache\temp'
$env:TMP=$env:TEMP
$env:NODE_COMPILE_CACHE=Join-Path $shireRoot 'cache\node-compile'
# Generated server modules live on E:; resolve the existing pnpm links from their original D: paths.
$env:NODE_PATH=Join-Path $shireFront 'node_modules'
if($Mode -eq 'Prepare' -or -not(Test-Path -LiteralPath (Join-Path $shireRoot 'assets\manifest.json'))){
  & $shireNode (Join-Path $PSScriptRoot 'prepare-shire-assets.mjs')
  if($LASTEXITCODE -ne 0){throw 'Local asset preparation failed. See the reported source or approval error.'}
}
if($Mode -eq 'Prepare'){exit 0}
if($Mode -eq 'Build'){
  if(Test-Path -LiteralPath $shireLedger){
    $shireRecord=Get-Content -LiteralPath $shireLedger -Raw | ConvertFrom-Json
    if(Get-Process -Id $shireRecord.processId -ErrorAction SilentlyContinue){throw 'Stop the owned Shire server before rebuilding its files.'}
  }
  Push-Location $shireFront
  $shireEnvTypesPath=Join-Path $shireFront 'next-env.d.ts'
  $shireEnvTypesBefore=[System.IO.File]::ReadAllBytes($shireEnvTypesPath)
  try{
    & $shireNode $shireNext build 2>&1 | Tee-Object -FilePath (Join-Path $shireRoot 'evidence\build.log')
    if($LASTEXITCODE -ne 0){throw 'The Shire build failed. Its build log is on E:.'}
  }finally{
    # Next regenerates this shared file for its selected output folder. Restore its exact prior bytes.
    [System.IO.File]::WriteAllBytes($shireEnvTypesPath,$shireEnvTypesBefore)
    Pop-Location
  }
  exit 0
}
if(-not(Test-Path -LiteralPath (Join-Path $shireOutput 'BUILD_ID'))){throw 'Build the local world first with scripts\shire-local.ps1 -Mode Build.'}
$shireUrl="http://127.0.0.1:$Port/play/shire"
if(Test-Path -LiteralPath $shireLedger){
  $shireRecord=Get-Content -LiteralPath $shireLedger -Raw | ConvertFrom-Json
  $shireRecordedProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($shireRecord.processId)"
  if($shireRecordedProcess){
    if($shireRecordedProcess.Name -ne 'node.exe' -or -not $shireRecordedProcess.CommandLine.Contains($shireNext)){throw 'The recorded server identity is uncertain. It was preserved; a second world writer was not started.'}
    if($shireRecord.port -ne $Port){throw "This E: save folder already has a running server on port $($shireRecord.port). A second writer on port $Port was refused."}
    $shireExistingListener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if(-not $shireExistingListener){throw 'The recorded local server is still starting or has lost its listener. It was preserved; check its E: logs before retrying.'}
    if($shireExistingListener.OwningProcess -ne $shireRecord.processId){throw 'The selected port belongs to a different process. Both processes were preserved.'}
    Write-Output "The local world is already running at $shireUrl"
    if($OpenBrowser){Start-Process $shireUrl}
    exit 0
  }
}
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){
  throw "Port $Port belongs to another process. It was left untouched. Choose another local port."
}
$shireServer=Start-Process -FilePath $shireNode -ArgumentList @($shireNext,'start','-H','127.0.0.1','-p',[string]$Port) -WorkingDirectory $shireFront -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $shireRoot 'evidence\server.log') -RedirectStandardError (Join-Path $shireRoot 'evidence\server-errors.log')
@{processId=$shireServer.Id;port=$Port;url=$shireUrl;storage=$shireRoot;startedAt=(Get-Date).ToUniversalTime().ToString('o');source=$shireRepo} | ConvertTo-Json | Set-Content -LiteralPath $shireLedger -Encoding utf8
$shireReady=$false
for($shireAttempt=0;$shireAttempt -lt 30;$shireAttempt++){
  try{$shireCheck=Invoke-RestMethod "http://127.0.0.1:$Port/api/shire" -TimeoutSec 2;if($shireCheck.storage -eq $shireRoot){$shireReady=$true;break}}catch{}
  if($shireServer.HasExited){throw 'The local server exited. Its logs are in the E: evidence folder.'}
  Start-Sleep -Milliseconds 300
}
if(-not $shireReady){throw 'The local server has not reported ready. Check its E: logs before opening the game.'}
Write-Output "Ready: $shireUrl"
Write-Output "Saves, assets, caches and builds: $shireRoot"
if($OpenBrowser){Start-Process $shireUrl}
} finally {
  if($shireLockHeld){$shireLaunchMutex.ReleaseMutex()}
  $shireLaunchMutex.Dispose()
}
