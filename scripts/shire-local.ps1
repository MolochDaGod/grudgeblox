[CmdletBinding()]
param(
  [ValidateSet('Plan','Stage','Prepare','Build','Start','Stop','Status')][string]$Mode='Start',
  [string]$DataRoot=$env:GRUDGE_SHIRE_DATA_ROOT,
  [string]$RuntimeRoot,
  [string]$WorkbenchRoot=$env:GRUDGE_WORKBENCH_ROOT,
  [ValidateRange(1024,65535)][int]$Port=4100,
  [switch]$OpenBrowser
)
$ErrorActionPreference='Stop'
$shireSource=Split-Path $PSScriptRoot -Parent
$shireConfig=Get-Content -LiteralPath (Join-Path $shireSource '.workspace-build.json') -Raw | ConvertFrom-Json
$shireBuildRoot=[IO.Path]::GetFullPath($shireConfig.buildRoot)
if($shireBuildRoot -ne 'D:\grudgegit\grudgeblox'){throw 'Use the canonical D:\grudgegit\grudgeblox build root.'}
$shireWork=Join-Path $shireBuildRoot 'shire'
if(-not $DataRoot){$DataRoot='C:\RuntimeData\grudgegit\grudgeblox\TheMiddleEarth'}
$shireData=[IO.Path]::GetFullPath($DataRoot)
if($shireData -notmatch '^C:\\'){throw 'Shire save records must be on C:. Supply the retained C: data root explicitly.'}
if(-not $RuntimeRoot){$RuntimeRoot=Join-Path $shireWork 'runtime'}
$shireRuntime=[IO.Path]::GetFullPath($RuntimeRoot)
if(-not $shireRuntime.StartsWith($shireBuildRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Runtime, dependencies and builds must stay under the canonical D: project root.'}
if(-not $WorkbenchRoot){
  $shireProducerRoot=if($env:GAME_ASSET_BULK){$env:GAME_ASSET_BULK}else{$env:GAME_ASSET_VAULT}
  if($shireProducerRoot){$WorkbenchRoot=Join-Path $shireProducerRoot 'Game integrations\shire'}
}
if($WorkbenchRoot){
  if(-not [IO.Path]::IsPathRooted($WorkbenchRoot)){throw 'Use an absolute Workbench delivery folder.'}
  $WorkbenchRoot=[IO.Path]::GetFullPath($WorkbenchRoot)
}
$shireFront=Join-Path $shireRuntime 'front'
$shireNext=Join-Path $shireFront 'node_modules\next\dist\bin\next'
$shireOutput=Join-Path $shireFront '.shire-next'
$shireLogs=Join-Path $shireWork 'logs'
$shireLedger=Join-Path $shireWork 'local-server.json'
$shireStamp=Join-Path $shireRuntime '.shire-source.json'
$shireRevision=(& git -C $shireSource rev-parse HEAD)
if($LASTEXITCODE -ne 0){throw 'The C: source revision could not be verified.'}
$shireUrl="http://127.0.0.1:$Port/play/shire"
if($Mode -eq 'Plan'){
  [ordered]@{
    source=$shireSource;sourceRevision=$shireRevision;runtime=$shireRuntime;build=$shireOutput
    dependencies=(Join-Path $shireRuntime 'node_modules');temporary=(Join-Path $shireWork 'temp')
    logs=$shireLogs;ledger=$shireLedger;data=$shireData;workbench=$WorkbenchRoot;url=$shireUrl
    dependenciesPresent=(Test-Path -LiteralPath $shireNext)
    assetsPresent=(Test-Path -LiteralPath (Join-Path $shireData 'assets\manifest.json'))
    deliveryPresent=([bool]$WorkbenchRoot -and (Test-Path -LiteralPath (Join-Path $WorkbenchRoot 'library.json')))
    buildPresent=(Test-Path -LiteralPath (Join-Path $shireOutput 'BUILD_ID'))
    stagePresent=(Test-Path -LiteralPath $shireStamp)
  } | ConvertTo-Json
  return
}
# One project mutex covers the shared server ledger across all data/runtime selections.
$shireHasher=[Security.Cryptography.SHA256]::Create()
$shireLockKey=([BitConverter]::ToString($shireHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($shireBuildRoot.TrimEnd('\').ToLowerInvariant())))).Replace('-','')
$shireHasher.Dispose()
$shireMutex=[Threading.Mutex]::new($false,"Local\GrudgeBloxShire_$shireLockKey")
$shireHeld=$false
try{
  try{$shireHeld=$shireMutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$shireHeld=$true}
  if(-not $shireHeld){throw 'This save folder already has a launcher operation in progress.'}
  if($Mode -eq 'Status'){
    if(Test-Path -LiteralPath $shireLedger){Get-Content -LiteralPath $shireLedger}else{'No owned Shire server is recorded.'}
    return
  }
  if($Mode -eq 'Stop'){
    if(-not(Test-Path -LiteralPath $shireLedger)){'No owned Shire server is recorded.';return}
    $shireRecord=Get-Content -LiteralPath $shireLedger -Raw | ConvertFrom-Json
    $shireProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($shireRecord.processId)"
    if($shireProcess){
      if($shireProcess.Name -ne 'node.exe' -or -not $shireProcess.CommandLine.Contains($shireRecord.next) -or -not $shireProcess.CommandLine.Contains('127.0.0.1')){throw 'The recorded process no longer matches this launcher. It was preserved.'}
      Stop-Process -Id $shireRecord.processId
    }
    Remove-Item -LiteralPath $shireLedger
    'The owned Shire server has stopped. Saved worlds remain on C:.'
    return
  }
  if($Mode -eq 'Stage'){
    if(Test-Path -LiteralPath $shireRuntime){throw 'The runtime folder already exists and was preserved. Choose a fresh -RuntimeRoot under the canonical D: project root.'}
    $shireDirty=(& git -C $shireSource status --porcelain --untracked-files=normal)
    if($shireDirty){throw 'Commit the source before staging. Dirty source work was preserved.'}
    $shireFiles=@(& git -C $shireSource ls-files)
    if($LASTEXITCODE -ne 0){throw 'The source file list could not be verified.'}
    foreach($shireFile in $shireFiles){
      $shireTarget=Join-Path $shireRuntime $shireFile
      [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($shireTarget)) | Out-Null
      [IO.File]::Copy((Join-Path $shireSource $shireFile),$shireTarget,$false)
    }
    $shireStageReceipt=@{source=$shireSource;revision=$shireRevision;files=$shireFiles.Count;stagedAt=(Get-Date).ToUniversalTime().ToString('o')} | ConvertTo-Json
    [IO.File]::WriteAllText($shireStamp,$shireStageReceipt,[Text.UTF8Encoding]::new($false))
    "Source staged at $shireRuntime. Install only the existing approved dependencies there after build resources are approved; this launcher does not download them."
    return
  }
  if(-not(Test-Path -LiteralPath $shireStamp)){throw 'Stage the committed C: source on D: first with -Mode Stage, after build resources are approved.'}
  $shireStaged=Get-Content -LiteralPath $shireStamp -Raw | ConvertFrom-Json
  if($shireStaged.source -ne $shireSource -or $shireStaged.revision -ne $shireRevision){throw 'The staged source does not match this C: checkout revision. Select a fresh staged runtime.'}
  if(& git -C $shireSource status --porcelain --untracked-files=normal){throw 'Commit current source edits and stage them before building or launching.'}
  if(Test-Path -LiteralPath $shireLedger){
    $shireRecord=Get-Content -LiteralPath $shireLedger -Raw | ConvertFrom-Json
    $shireRecordedProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($shireRecord.processId)"
    if($shireRecordedProcess){
      if($Mode -ne 'Start'){throw 'Stop the owned Shire server before preparing or rebuilding.'}
      if($shireRecordedProcess.Name -ne 'node.exe' -or -not $shireRecordedProcess.CommandLine.Contains($shireRecord.next) -or -not $shireRecordedProcess.CommandLine.Contains('127.0.0.1')){throw 'The recorded server identity is uncertain. It was preserved.'}
      if($shireRecord.storage -ne $shireData -or $shireRecord.runtime -ne $shireRuntime -or $shireRecord.workbench -ne $WorkbenchRoot -or $shireRecord.port -ne $Port){throw 'An owned server is running with different paths or port. It was preserved.'}
      $shireListener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
      if(-not $shireListener -or @($shireListener | Where-Object {$_.OwningProcess -ne $shireRecord.processId -or $_.LocalAddress -ne '127.0.0.1'}).Count){throw 'The recorded server listener is unavailable or belongs to a different process.'}
      "The local world is already running at $shireUrl"
      if($OpenBrowser){Start-Process $shireUrl}
      return
    }
  }
  $shireNode=(Get-Command node.exe -ErrorAction Stop).Source
  if($Mode -ne 'Prepare' -and -not(Test-Path -LiteralPath $shireNext)){throw "Existing Next dependencies are missing from $shireFront. No download or alternate source dependency folder was used."}
  foreach($shireFolder in @($shireLogs,(Join-Path $shireWork 'temp'),(Join-Path $shireWork 'node-compile'))){[IO.Directory]::CreateDirectory($shireFolder) | Out-Null}
  $env:GRUDGE_LOCAL_WORLD='shire'
  $env:GRUDGE_SHIRE_DATA_ROOT=$shireData
  $env:GRUDGE_WORKBENCH_ROOT=$WorkbenchRoot
  $env:NEXT_TELEMETRY_DISABLED='1'
  $env:TEMP=Join-Path $shireWork 'temp';$env:TMP=$env:TEMP
  $env:NODE_COMPILE_CACHE=Join-Path $shireWork 'node-compile'
  $env:NODE_PATH=Join-Path $shireFront 'node_modules'
  if($Mode -eq 'Prepare'){
    & $shireNode (Join-Path $shireRuntime 'scripts\prepare-shire-assets.mjs')
    if($LASTEXITCODE -ne 0){throw 'Asset preparation failed. Existing retained data was preserved.'}
    return
  }
  if($Mode -eq 'Build'){
    Push-Location $shireFront
    try{
      $shireArgumentsJson=& $shireNode (Join-Path $shireRuntime 'scripts\shire-next-build-args.mjs') (Join-Path $shireFront 'node_modules\next\package.json')
      if($LASTEXITCODE -ne 0){throw 'The staged installed Next version could not be verified.'}
      $shireBuildArguments=@($shireArgumentsJson | ConvertFrom-Json)
      & $shireNode $shireNext @shireBuildArguments 2>&1 | Tee-Object -FilePath (Join-Path $shireLogs 'build.log')
      if($LASTEXITCODE -ne 0){throw 'Shire build failed. See the D: build log.'}
    }finally{Pop-Location}
    return
  }
  if(-not(Test-Path -LiteralPath (Join-Path $shireData 'assets\manifest.json'))){throw 'The retained C: asset manifest is unavailable. Supply the existing data root; Start never initializes a replacement world store.'}
  if(-not $WorkbenchRoot -or -not(Test-Path -LiteralPath (Join-Path $WorkbenchRoot 'library.json'))){throw 'The selected Workbench delivery manifest is unavailable. Qualify -WorkbenchRoot before launching.'}
  if($WorkbenchRoot -match '^[EF]:\\'){throw 'Workbench heartbeat cannot write to E: releases or F: non-project data. Qualify the producer delivery root before launch.'}
  if(-not(Test-Path -LiteralPath (Join-Path $shireOutput 'BUILD_ID'))){throw 'Build the staged local world first with -Mode Build, after build resources are approved.'}
  if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw "Port $Port belongs to another process and was preserved."}
  $shireServer=Start-Process -FilePath $shireNode -ArgumentList @(('"' + $shireNext + '"'),'start','-H','127.0.0.1','-p',[string]$Port) -WorkingDirectory $shireFront -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $shireLogs 'server.log') -RedirectStandardError (Join-Path $shireLogs 'server-errors.log')
  @{processId=$shireServer.Id;port=$Port;url=$shireUrl;storage=$shireData;runtime=$shireRuntime;next=$shireNext;workbench=$WorkbenchRoot;source=$shireSource;revision=$shireRevision;startedAt=(Get-Date).ToUniversalTime().ToString('o')} |
    ConvertTo-Json | Set-Content -LiteralPath $shireLedger -Encoding utf8
  $shireReady=$false
  for($shireAttempt=0;$shireAttempt -lt 30;$shireAttempt++){
    try{$shireCheck=Invoke-RestMethod "http://127.0.0.1:$Port/api/shire" -TimeoutSec 2;if($shireCheck.storage -eq $shireData){$shireReady=$true;break}}catch{}
    if($shireServer.HasExited){throw 'The local server exited. See its D: logs.'}
    Start-Sleep -Milliseconds 300
  }
  if(-not $shireReady){throw 'The server has not reported ready. Check its D: logs before opening the game.'}
  "Ready: $shireUrl"
  "Saved worlds: $shireData; runtime and logs: $shireWork; Workbench delivery: $WorkbenchRoot"
  if($OpenBrowser){Start-Process $shireUrl}
}finally{
  if($shireHeld){$shireMutex.ReleaseMutex()}
  $shireMutex.Dispose()
}
