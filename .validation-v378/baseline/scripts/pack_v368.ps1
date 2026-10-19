$src = "D:\EMR\Borkeo_EMR_v36.3"
$staging = "D:\EMR\temp_v368_staging"
$zipDest = "D:\EMR\Borkeo_EMR_v36.8.zip"

if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
if (Test-Path $zipDest) { Remove-Item -Force $zipDest }

New-Item -ItemType Directory -Path $staging | Out-Null

$items = Get-ChildItem -Path $src -Exclude "node_modules", ".git", "temp_*", "*.zip"
foreach ($item in $items) {
    if ($item.PSIsContainer) {
        Copy-Item -Path $item.FullName -Destination (Join-Path $staging $item.Name) -Recurse -Force
    } else {
        Copy-Item -Path $item.FullName -Destination (Join-Path $staging $item.Name) -Force
    }
}

# Remove any temporary WAL/SHM lock files from staging if copied
$walFiles = Get-ChildItem -Path (Join-Path $staging "data") -Filter "demo.sqlite-*" -ErrorAction SilentlyContinue
if ($walFiles) {
    $walFiles | Remove-Item -Force
}

Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipDest -CompressionLevel Optimal
Remove-Item -Recurse -Force $staging
Write-Host "ZIP created successfully: $zipDest"
