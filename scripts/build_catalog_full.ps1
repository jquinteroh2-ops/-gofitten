$ErrorActionPreference = "Stop"
$dir = "c:\Users\joseq\Desktop\pagina para Nathaly y Carlos"
$imgDir = "$dir\images\productos"
if (-not (Test-Path $imgDir)) { New-Item -ItemType Directory -Force -Path $imgDir | Out-Null }

$utf8 = New-Object System.Text.UTF8Encoding($false)
$rawText = [System.IO.File]::ReadAllText("$dir\products_raw_all.json", $utf8)
$j = $rawText | ConvertFrom-Json

# Mapeo real handle->categoria obtenido de las colecciones del sitio (Hombre/Mujer/Niños/Accesorios/Deportes)
$mapText = [System.IO.File]::ReadAllText("$dir\handle_category_map.json", $utf8)
$mapObj = $mapText | ConvertFrom-Json
$handleCatMap = @{}
foreach ($prop in $mapObj.PSObject.Properties) { $handleCatMap[$prop.Name] = $prop.Value }
"Handles con categoria real: $($handleCatMap.Count)"

# Mapeo handle->subcategoria (submenus: Buzos & Chaquetas, Crop Tops, Medias, etc.)
$handleSubMap = @{}
$subMapPath = "$dir\handle_subcategory_map.json"
if (Test-Path $subMapPath) {
    $subText = [System.IO.File]::ReadAllText($subMapPath, $utf8)
    $subObj = $subText | ConvertFrom-Json
    foreach ($prop in $subObj.PSObject.Properties) { $handleSubMap[$prop.Name] = $prop.Value }
}
"Handles con subcategoria: $($handleSubMap.Count)"

# Mapeo handle->actividad deportiva (Ciclismo/Crossfit/Fitness/Tennis-Padel/Running),
# independiente de la subcategoria estructural porque se solapa con todas las categorias.
$handleActivityMap = @{}
$actMapPath = "$dir\handle_activity_map.json"
if (Test-Path $actMapPath) {
    $actText = [System.IO.File]::ReadAllText($actMapPath, $utf8)
    $actObj = $actText | ConvertFrom-Json
    foreach ($prop in $actObj.PSObject.Properties) { $handleActivityMap[$prop.Name] = $prop.Value }
}
"Handles con actividad: $($handleActivityMap.Count)"

# Handles en oferta
$ofertasSet = @{}
$ofertasPath = "$dir\ofertas_handles.json"
if (Test-Path $ofertasPath) {
    $ofText = [System.IO.File]::ReadAllText($ofertasPath, $utf8)
    $ofArr = $ofText | ConvertFrom-Json
    foreach ($h in $ofArr) { $ofertasSet[$h] = $true }
}
"Handles en oferta: $($ofertasSet.Count)"

function Get-Category($title) {
    $t = $title.ToLower()
    if ($t -match "ni[nñ]a|ni[nñ]o|ni[nñ]os|tiny|kids|beb|infantil") { return "ninos" }
    if ($t -match "termo|bottle|botella|\bmedia\b|\bmedias\b|gorra|bolso|maleta|guante|banda|tobillera|riñonera|toalla|accesor|mochila|canguro|pantorrillera|sport bag|toten bag|visera|sweatband|pasamonta|shaker|straps|faja|cinturilla|scrunchie") { return "accesorios" }
    if ($t -match "dama|mujer|leggin|leggins|\btop\b|falda|esqueleto|brasier|body|enteriza|conjunto|blusa|licra|femenino") { return "mujer" }
    if ($t -match "hombre|masculino|caballero") { return "hombre" }
    return "deportes"
}

function Format-Price($p) {
    $n = [int]([double]$p)
    return ("{0:N0}" -f $n).Replace(",", ".")
}

function Clean-Description($html) {
    if (-not $html) { return "" }
    $t = [regex]::Replace($html, '(?is)<(script|style)[^>]*>.*?</\1>', ' ')
    $t = [regex]::Replace($t, '(?i)</p>|<br\s*/?>|</li>', "`n")
    $t = [regex]::Replace($t, '<[^>]+>', ' ')
    $t = [System.Net.WebUtility]::HtmlDecode($t)
    $t = [regex]::Replace($t, '(?i)tenfit\s*express', 'GoFitten')
    $t = [regex]::Replace($t, '[ \t]+', ' ')
    $t = [regex]::Replace($t, ' *\n *', "`n")
    $t = [regex]::Replace($t, '\n{3,}', "`n`n")
    return $t.Trim()
}

# ---- Paso 1: armar lista de productos + lista de descargas pendientes ----
$products = New-Object System.Collections.ArrayList
$downloads = New-Object System.Collections.ArrayList  # @{url=; path=}

foreach ($p in $j.products) {
    if ($p.images.Count -eq 0) { continue }
    if ($handleCatMap.ContainsKey($p.handle)) {
        $cat = $handleCatMap[$p.handle]
    } else {
        $cat = Get-Category $p.title
    }
    $priceRaw = $p.variants[0].price
    $price = Format-Price $priceRaw
    $available = $false
    foreach ($v in $p.variants) { if ($v.available) { $available = $true } }

    $sizes = New-Object System.Collections.ArrayList
    foreach ($v in $p.variants) {
        $opt = $v.title
        if ($opt -and $opt -ne "Default Title" -and -not $sizes.Contains($opt)) { [void]$sizes.Add($opt) }
    }

    $localImgs = New-Object System.Collections.ArrayList
    $maxImgs = [Math]::Min(2, $p.images.Count)
    for ($i = 0; $i -lt $maxImgs; $i++) {
        $src = $p.images[$i].src
        $clean = $src.Split("?")[0]
        $ext = [System.IO.Path]::GetExtension($clean)
        if (-not $ext) { $ext = ".jpg" }
        $fname = "$($p.handle)-$i$ext"
        $fpath = "$imgDir\$fname"
        [void]$localImgs.Add("images/productos/$fname")
        if (-not (Test-Path $fpath)) {
            [void]$downloads.Add([pscustomobject]@{ url = $src; path = $fpath })
        }
    }

    $desc = Clean-Description $p.body_html
    $subcat = if ($handleSubMap.ContainsKey($p.handle)) { $handleSubMap[$p.handle] } else { "" }
    $activity = if ($handleActivityMap.ContainsKey($p.handle)) { $handleActivityMap[$p.handle] } else { "" }

    # Varias subcolecciones oficiales del sitio estan casi vacias (ej. "Sudaderas & Joggers"
    # hombre solo tenia 1 producto etiquetado). Reforzamos por palabra clave del titulo,
    # sin pisar una subcategoria ya confirmada por una coleccion bien poblada.
    $tLower = $p.title.ToLower()
    $canOverride = ($subcat -eq "")

    if ($cat -eq "ninos") {
        if ($tLower -match "ni[nñ]a\b") { $subcat = "Niñas" }
        elseif ($tLower -match "ni[nñ]o\b") { $subcat = "Niños" }
        else { $subcat = "" }
    }
    elseif ($cat -eq "hombre" -and $canOverride) {
        if ($tLower -match "jogger|sudadera") { $subcat = "Sudaderas & Joggers" }
        elseif ($tLower -match "pantaloneta|licra") { $subcat = "Pantalonetas & Licras" }
        elseif ($tLower -match "buzo|chaqueta|hoodie") { $subcat = "Buzos & Chaquetas" }
        elseif ($tLower -match "camiseta|camisilla|polo") { $subcat = "Camisetas & Camisillas" }
    }
    elseif ($cat -eq "mujer" -and $canOverride) {
        if ($tLower -match "jogger|sudadera") { $subcat = "Jogger & Sudaderas" }
        elseif ($tLower -match "crop\s*top") { $subcat = "Crop Tops" }
        elseif ($tLower -match "leggin") { $subcat = "Leggins & Capris" }
        elseif ($tLower -match "falda|enteriza|enterizo") { $subcat = "Falda Shorts & Enterizos" }
        elseif ($tLower -match "conjunto") { $subcat = "Conjuntos" }
        elseif ($tLower -match "buzo|chaqueta|hoodie") { $subcat = "Buzos & Chaquetas" }
        elseif ($tLower -match "blusa|camiseta|camisilla") { $subcat = "Camisetas & Blusas" }
        elseif ($tLower -match "\btop\b|esqueleto") { $subcat = "Tops" }
    }

    # Oferta real: precio comparativo (compare_at_price) mayor al precio actual
    $compareRaw = $p.variants[0].compare_at_price
    $compareNum = 0
    if ($compareRaw) { $compareNum = [int]([double]$compareRaw) }
    $realSale = $compareNum -gt ([int]([double]$priceRaw))
    $onSale = $ofertasSet.ContainsKey($p.handle) -or $realSale

    $obj = [ordered]@{
        id             = $p.handle
        title          = $p.title
        price          = $price
        priceNum       = [int]([double]$priceRaw)
        compareAtPrice = $(if ($realSale) { $compareNum } else { $null })
        category       = $cat
        subcategory    = $subcat
        activity       = $activity
        onSale         = $onSale
        available      = $available
        sizes          = @($sizes)
        images         = @($localImgs)
        description    = $desc
    }
    [void]$products.Add($obj)
}

"Productos con imagen: $($products.Count)"
"Archivos a descargar: $($downloads.Count)"

# ---- Paso 2: descargar imagenes en paralelo con RunspacePool ----
if ($downloads.Count -gt 0) {
    $maxConcurrency = 20
    $pool = [runspacefactory]::CreateRunspacePool(1, $maxConcurrency)
    $pool.Open()

    $downloadScript = {
        param($url, $path)
        try {
            $wc = New-Object System.Net.WebClient
            $wc.Headers.Add("User-Agent", "Mozilla/5.0")
            $wc.DownloadFile($url, $path)
            return $true
        } catch {
            return $false
        } finally {
            if ($wc) { $wc.Dispose() }
        }
    }

    $jobs = New-Object System.Collections.Generic.List[object]
    foreach ($d in $downloads) {
        $ps = [powershell]::Create()
        $ps.RunspacePool = $pool
        [void]$ps.AddScript($downloadScript).AddArgument($d.url).AddArgument($d.path)
        $handle = $ps.BeginInvoke()
        $jobs.Add([pscustomobject]@{ Pipe = $ps; Handle = $handle })
    }

    $total = $jobs.Count
    $okCount = 0
    $errCount = 0
    $n = 0
    foreach ($job in $jobs) {
        try {
            $result = $job.Pipe.EndInvoke($job.Handle)
            if ($result -and $result[0] -eq $true) { $okCount++ } else { $errCount++ }
        } catch { $errCount++ }
        $job.Pipe.Dispose()
        $n++
        if ($n % 300 -eq 0) { "Progreso: $n / $total (ok=$okCount err=$errCount)" }
    }
    "Descargas completas. OK=$okCount ERR=$errCount de $total"
    $pool.Close()
    $pool.Dispose()
}

# ---- Paso 3: guardar catalogo ----
New-Item -ItemType Directory -Force -Path "$dir\data" | Out-Null
$json = $products | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText("$dir\data\products.json", $json, $utf8)

$jsWrap = "window.PRODUCTS = " + $json + ";"
New-Item -ItemType Directory -Force -Path "$dir\js" | Out-Null
[System.IO.File]::WriteAllText("$dir\js\products.js", $jsWrap, $utf8)

"=== RESUMEN ==="
$products | Group-Object category | Sort-Object Count -Descending | ForEach-Object { "  $($_.Name): $($_.Count)" }
"products.js generado."
