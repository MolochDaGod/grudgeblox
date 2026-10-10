[CmdletBinding()]
param([ValidateSet('Build','Launch','BuildLaunch')][string]$Action='Launch')
$ErrorActionPreference='Stop'
if($env:WORKSPACE_LAUNCHER_PROJECT -ne 'grudgegit/grudgeblox'){throw 'Use the registered Project Console workspace controls.'}
. 'C:\github\ProjectLaunchers\workspace-tools\Common.ps1'
if($Action -in @('Build','BuildLaunch')){
  & (Get-WorkspaceCatalog).tools.node (Join-Path $PSScriptRoot 'scripts\workspace-build-shire.cjs')
  if($LASTEXITCODE -ne 0){throw 'The Shire Console build failed. Retained data and previous successful output were preserved.'}
}
if($Action -in @('Launch','BuildLaunch')){& (Join-Path $PSScriptRoot 'Workbench-Portal.ps1') -Action Start}
