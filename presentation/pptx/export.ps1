param(
  [string]$Source,
  [string]$Pptx,
  [string]$Pdf,
  [string]$Shots
)
$ErrorActionPreference = "Stop"
$app = New-Object -ComObject PowerPoint.Application
try {
  $deck = $app.Presentations.Open($Source, -1, 0, 0)
  $deck.SaveAs($Pptx, 24, -1)
  $deck.SaveAs($Pdf, 32)
  if ($Shots) {
    New-Item -ItemType Directory -Force -Path $Shots | Out-Null
    Get-ChildItem $Shots -Filter "slide-*.png" | Remove-Item -Force
    for ($i = 1; $i -le $deck.Slides.Count; $i++) {
      $deck.Slides.Item($i).Export((Join-Path $Shots ("slide-{0:D2}.png" -f $i)), "PNG", 1920, 1080)
    }
  }
  Write-Output ("slides: " + $deck.Slides.Count)
  $counts = for ($i = 1; $i -le $deck.Slides.Count; $i++) { $deck.Slides.Item($i).TimeLine.MainSequence.Count }
  Write-Output ("effects per slide: " + ($counts -join " "))
  $deck.Close()
} finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}
