param(
  [string]$Source,
  [string]$Video,
  [int]$First = 1,
  [int]$Last = 0,
  [int]$Seconds = 5
)
$ErrorActionPreference = "Stop"
$app = New-Object -ComObject PowerPoint.Application
try {
  $deck = $app.Presentations.Open($Source, -1, -1, 0)
  if ($Last -le 0) { $Last = $deck.Slides.Count }
  for ($i = $deck.Slides.Count; $i -ge 1; $i--) {
    if ($i -lt $First -or $i -gt $Last) { $deck.Slides.Item($i).Delete() }
  }
  $deck.CreateVideo($Video, $false, $Seconds, 720, 25, 80)
  while ($deck.CreateVideoStatus -eq 1 -or $deck.CreateVideoStatus -eq 2) { Start-Sleep -Milliseconds 500 }
  Write-Output ("video status: " + $deck.CreateVideoStatus)
  $deck.Close()
} finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}
