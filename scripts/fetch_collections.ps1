$ErrorActionPreference = "Stop"
$dir = "c:\Users\joseq\Desktop\pagina para Nathaly y Carlos"
$utf8 = New-Object System.Text.UTF8Encoding($false)

$cats = @{
    hombre     = "hombre"
    mujer      = "mujer"
    ninos      = "ropa-de-ninos"
    accesorios = "accesorios"
    deportes   = "deportes"
}

# handle -> categoria (para asignar en orden de prioridad; el primero que matchee gana)
$handleToCat = New-Object System.Collections.Specialized.OrderedDictionary
foreach ($catKey in $cats.Keys) {
    $collHandle = $cats[$catKey]
    $page = 1
    $countTotal = 0
    while ($true) {
        $url = "https://www.mayorista.tenfitexpress.com/collections/$collHandle/products.json?limit=250&page=$page"
        $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 40
        $bytes = $resp.RawContentStream.ToArray()
        $text = $utf8.GetString($bytes)
        $j = $text | ConvertFrom-Json
        if ($j.products.Count -eq 0) { break }
        foreach ($p in $j.products) {
            if (-not $handleToCat.Contains($p.handle)) {
                $handleToCat.Add($p.handle, $catKey)
            }
        }
        $countTotal += $j.products.Count
        $page++
        if ($page -gt 20) { break }
    }
    "Categoria '$catKey' (coleccion '$collHandle'): $countTotal productos"
}

"Total handles mapeados: $($handleToCat.Count)"

$json = $handleToCat | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText("$dir\handle_category_map.json", $json, $utf8)
"Guardado en handle_category_map.json"
