$ErrorActionPreference = "Stop"
$dir = "c:\Users\joseq\Desktop\pagina para Nathaly y Carlos"
$utf8 = New-Object System.Text.UTF8Encoding($false)

# handle de coleccion -> nombre de subcategoria a mostrar
$subcats = [ordered]@{
    "buzos-y-chaquetas-hombre"        = "Buzos & Chaquetas"
    "camisetas-camisillas"            = "Camisetas & Camisillas"
    "pantalonetas-y-licras"           = "Pantalonetas & Licras"
    "sudaderas-joggers-hombre"        = "Sudaderas & Joggers"

    "camisetas-y-blusas"              = "Camisetas & Blusas"
    "buzos-y-chaquetas-mujer"         = "Buzos & Chaquetas"
    "crop-tops"                       = "Crop Tops"
    "tops"                            = "Tops"
    "shorts-y-bikers"                 = "Shorts & Bikers"
    "falda-shorts-y-enterizos-mujer"  = "Falda Shorts & Enterizos"
    "conjuntos-mujer"                 = "Conjuntos"
    "jogger-y-sudaderas-mujer"        = "Jogger & Sudaderas"
    "leggins-y-capris"                = "Leggins & Capris"

    "ropa-deportiva-para-ninas"       = "Niñas"
    "ropa-deportiva-para-ninos"       = "Niños"

    "medias"                          = "Medias"
    "pantorrillera-compresion-running"= "Pantorrillera Compresión"
    "sport-bag"                       = "Sport Bag"
    "guantes"                         = "Guantes"
    "straps-pesas"                    = "Straps Pesas"
    "faja-cinturilla"                 = "Faja Cinturilla"
    "sweatband-tenfit"                = "Sweatband Tenfit"
    "pasamontanas"                    = "Pasamontañas"
    "shaker-ultra"                    = "Shaker Ultra"
    "visor-ayra"                      = "Visor Ayra"
    "scrunchie-3-pack"                = "Scrunchie 3Pack"
}

# Actividades deportivas (Ciclismo/Crossfit/Fitness/Tennis-Padel/Running): se guardan APARTE
# porque se solapan con TODAS las demas categorias (una legging de mujer puede ser "Running" tambien).
$activities = [ordered]@{
    "ciclismo"                        = "Ciclismo"
    "crossfit"                        = "Crossfit"
    "fitness"                         = "Fitness"
    "tennis-padel"                    = "Tennis - Padel"
    "running"                         = "Running"
}

# handle_producto -> nombre_subcategoria (primer match gana)
$handleToSub = New-Object System.Collections.Specialized.OrderedDictionary

foreach ($collHandle in $subcats.Keys) {
    $subName = $subcats[$collHandle]
    $page = 1
    $countTotal = 0
    while ($true) {
        $url = "https://www.mayorista.tenfitexpress.com/collections/$collHandle/products.json?limit=250&page=$page"
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 40
        } catch {
            "  ERROR en $collHandle pagina $page : $($_.Exception.Message)"
            break
        }
        $bytes = $resp.RawContentStream.ToArray()
        $text = $utf8.GetString($bytes)
        $j = $text | ConvertFrom-Json
        if ($j.products.Count -eq 0) { break }
        foreach ($p in $j.products) {
            if (-not $handleToSub.Contains($p.handle)) {
                $handleToSub.Add($p.handle, $subName)
            }
        }
        $countTotal += $j.products.Count
        $page++
        if ($page -gt 20) { break }
    }
    "Subcategoria '$subName' ($collHandle): $countTotal productos"
}
"Total handles con subcategoria: $($handleToSub.Count)"
$json1 = $handleToSub | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText("$dir\handle_subcategory_map.json", $json1, $utf8)

# handle_producto -> actividad (primer match gana, pero independiente de la subcategoria estructural)
$handleToActivity = New-Object System.Collections.Specialized.OrderedDictionary
foreach ($collHandle in $activities.Keys) {
    $actName = $activities[$collHandle]
    $page = 1
    $countTotal = 0
    while ($true) {
        $url = "https://www.mayorista.tenfitexpress.com/collections/$collHandle/products.json?limit=250&page=$page"
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 40
        } catch {
            "  ERROR en $collHandle pagina $page : $($_.Exception.Message)"
            break
        }
        $bytes = $resp.RawContentStream.ToArray()
        $text = $utf8.GetString($bytes)
        $j = $text | ConvertFrom-Json
        if ($j.products.Count -eq 0) { break }
        foreach ($p in $j.products) {
            if (-not $handleToActivity.Contains($p.handle)) {
                $handleToActivity.Add($p.handle, $actName)
            }
        }
        $countTotal += $j.products.Count
        $page++
        if ($page -gt 20) { break }
    }
    "Actividad '$actName' ($collHandle): $countTotal productos"
}
"Total handles con actividad: $($handleToActivity.Count)"
$json3 = $handleToActivity | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText("$dir\handle_activity_map.json", $json3, $utf8)

# ---- Ofertas ----
$ofertasHandles = New-Object System.Collections.ArrayList
$page = 1
while ($true) {
    $url = "https://www.mayorista.tenfitexpress.com/collections/ofertas/products.json?limit=250&page=$page"
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 40
    $bytes = $resp.RawContentStream.ToArray()
    $text = $utf8.GetString($bytes)
    $j = $text | ConvertFrom-Json
    if ($j.products.Count -eq 0) { break }
    foreach ($p in $j.products) { [void]$ofertasHandles.Add($p.handle) }
    $page++
    if ($page -gt 20) { break }
}
"Productos en Ofertas: $($ofertasHandles.Count)"
$json2 = $ofertasHandles | ConvertTo-Json -Depth 2
[System.IO.File]::WriteAllText("$dir\ofertas_handles.json", $json2, $utf8)

"Listo."
