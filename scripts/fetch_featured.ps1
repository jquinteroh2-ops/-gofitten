$ErrorActionPreference = "Stop"
$dir = "c:\Users\joseq\Desktop\pagina para Nathaly y Carlos"
$utf8 = New-Object System.Text.UTF8Encoding($false)

$featured = @{
    nuevos   = "nuevos-lanzamientos"
    vendidos = "mas-vendidos"
    leggins  = "amantes-de-los-leggings"
}

$result = [ordered]@{}
foreach ($key in $featured.Keys) {
    $collHandle = $featured[$key]
    $url = "https://www.mayorista.tenfitexpress.com/collections/$collHandle/products.json?limit=30&page=1"
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 40
    $bytes = $resp.RawContentStream.ToArray()
    $text = $utf8.GetString($bytes)
    $j = $text | ConvertFrom-Json
    $handles = @()
    foreach ($p in $j.products) { $handles += $p.handle }
    $result[$key] = $handles
    "Coleccion '$key' ($collHandle): $($handles.Count) handles obtenidos"
}

$json = $result | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText("$dir\featured_handles.json", $json, $utf8)
"Guardado en featured_handles.json"
