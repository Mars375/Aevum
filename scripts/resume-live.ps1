# Relance le direct de parties arrêtées par un quota de fournisseur.
#
# Le serveur abandonne le direct après dix échecs de suite (LIVE_TIMING) : c'est
# voulu, un fournisseur qui répond « revenez dans huit heures » ne doit pas être
# harcelé. Ce script revient toutes les 30 minutes, et ne relance que les
# parties encore inachevées dont le direct est coupé. Il s'arrête seul quand
# toutes sont finies, ou après 24 heures.
#
# Usage : powershell -File scripts/resume-live.ps1 -Ids id1,id2 [-Port 5174]
param(
  [Parameter(Mandatory = $true)][string[]]$Ids,
  [int]$Port = 5174,
  [int]$EverySeconds = 1800,
  [int]$MaxHours = 24
)
# Avec -File, « a,b » arrive en une seule chaîne : on la découpe ici.
$Ids = $Ids | ForEach-Object { $_ -split ',' } | Where-Object { $_ }
$base = "http://127.0.0.1:$Port/api/campaigns"
$headers = @{ Origin = "http://127.0.0.1:$Port" }
$deadline = (Get-Date).AddHours($MaxHours)
$log = Join-Path $PSScriptRoot '..\resume-live.log'
function Write-Log([string]$m) { Add-Content -Path $log -Value ((Get-Date).ToString('s') + ' ' + $m) }

while ((Get-Date) -lt $deadline) {
  # Une partie repartie peut retomber sur un autre quota (27-28/09 : OpenRouter
  # la veille, Mistral la nuit suivante) : on veille jusqu'à la fin, pas
  # jusqu'à la première relance.
  $pending = 0
  foreach ($id in $Ids) {
    try {
      $head = Invoke-RestMethod -Uri "$base/$id/head" -TimeoutSec 10
    } catch { Write-Log "$id : serveur injoignable"; $pending++; continue }
    if ($head.turns -ge 1200) { continue }
    $pending++
    if ($head.live.on) { continue }
    try {
      Invoke-RestMethod -Method Post -Uri "$base/$id/live" -Headers $headers `
        -ContentType 'application/json' -Body '{"live":true}' -TimeoutSec 10 | Out-Null
      Write-Log "$id : direct relancé à $($head.turns) actions"
    } catch { Write-Log "$id : relance refusée ($($_.Exception.Message))" }
  }
  if ($pending -eq 0) { Write-Log 'toutes les parties sont finies'; break }
  Start-Sleep -Seconds $EverySeconds
}
