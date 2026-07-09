$ErrorActionPreference = "Stop"
$dir = "c:\Users\joseq\Desktop\pagina para Nathaly y Carlos"
$utf8 = New-Object System.Text.UTF8Encoding($false)

$all = New-Object System.Collections.ArrayList
for ($page = 1; $page -le 14; $page++) {
    $url = "https://www.mayorista.tenfitexpress.com/products.json?limit=250&page=$page"
    $ok = $false
    for ($attempt = 1; $attempt -le 3 -and -not $ok; $attempt++) {
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 40
            $bytes = $resp.RawContentStream.ToArray()
            $text = $utf8.GetString($bytes)
            $j = $text | ConvertFrom-Json
            foreach ($p in $j.products) { [void]$all.Add($p) }
            "Pagina $page -> $($j.products.Count) productos (acumulado: $($all.Count))"
            $ok = $true
        } catch {
            "Pagina $page intento $attempt fallo: $($_.Exception.Message)"
            Start-Sleep -Seconds 2
        }
    }
    if ($all.Count -gt 0 -and $page -gt 1) {
        $lastBatchEmpty = $j.products.Count -eq 0
        if ($lastBatchEmpty) { break }
    }
}

# Deduplicar por handle (por si acaso)
$seen = @{}
$dedup = New-Object System.Collections.ArrayList
foreach ($p in $all) {
    if (-not $seen.ContainsKey($p.handle)) {
        $seen[$p.handle] = $true
        [void]$dedup.Add($p)
    }
}

"Total bruto: $($all.Count) | Unicos por handle: $($dedup.Count)"

$wrapper = [ordered]@{ products = $dedup }
$json = $wrapper | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText("$dir\products_raw_all.json", $json, $utf8)
"Guardado en products_raw_all.json"
