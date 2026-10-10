[CmdletBinding()]
param([ValidateSet('Start','Stop','Status')][string]$Action='Status')
& 'C:\github\game-asset-workbench\Portal-Console.ps1' -Target shire -Action $Action
