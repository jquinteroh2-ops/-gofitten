$ErrorActionPreference = "Stop"
$dir = "c:\Users\joseq\Desktop\pagina para Nathaly y Carlos"
$imgDir = "$dir\images\productos"
if (-not (Test-Path $imgDir)) { New-Item -ItemType Directory -Force -Path $imgDir | Out-Null }

# Leer el JSON original con UTF-8 explicito para preservar tildes
$utf8 = New-Object System.Text.UTF8Encoding($false)
$rawText = [System.IO.File]::ReadAllText("$dir\products_raw.json", $utf8)
$j = $rawText | ConvertFrom-Json

function Get-Category($title) {
    $t = $title.ToLower()
    if ($t -match "ni[nñ]a|ni[nñ]o|ni[nñ]os|tiny|kids|beb|infantil") { return "ninos" }
    if ($t -match "hombre|masculino|caballero") { return "hombre" }
    if ($t -match "termo|bottle|botella|\bmedia\b|\bmedias\b|gorra|bolso|maleta|guante|banda|tobillera|riñonera|toalla|accesor|mochila|canguro") { return "accesorios" }
    if ($t -match "mujer|leggin|leggins|\btop\b|falda|esqueleto|brasier|body|enteriza|conjunto|blusa|licra|femenino") { return "mujer" }
    return "deportes"
}

function Format-Price($p) {
    $n = [int]([double]$p)
    return ("{0:N0}" -f $n).Replace(",", ".")
}

function Clean-Description($html) {
    if (-not $html) { return "" }
    # quitar bloques script/style
    $t = [regex]::Replace($html, '(?is)<(script|style)[^>]*>.*?</\1>', ' ')
    # convertir saltos de linea comunes
    $t = [regex]::Replace($t, '(?i)</p>|<br\s*/?>|</li>', "`n")
    # quitar todas las etiquetas
    $t = [regex]::Replace($t, '<[^>]+>', ' ')
    # decodificar entidades HTML
    $t = [System.Net.WebUtility]::HtmlDecode($t)
    # reemplazar marca original por la nueva
    $t = [regex]::Replace($t, '(?i)tenfit\s*express', 'FitStyle')
    # colapsar espacios y limpiar
    $t = [regex]::Replace($t, '[ \t]+', ' ')
    $t = [regex]::Replace($t, ' *\n *', "`n")
    $t = [regex]::Replace($t, '\n{3,}', "`n`n")
    return $t.Trim()
}

$out = New-Object System.Collections.ArrayList
$count = 0
foreach ($p in $j.products) {
    if ($p.images.Count -eq 0) { continue }
    $cat = Get-Category $p.title
    $priceRaw = $p.variants[0].price
    $price = Format-Price $priceRaw
    $available = $false
    foreach ($v in $p.variants) { if ($v.available) { $available = $true } }

    # recolectar tallas disponibles desde las variantes
    $sizes = New-Object System.Collections.ArrayList
    foreach ($v in $p.variants) {
        $opt = $v.title
        if ($opt -and $opt -ne "Default Title" -and -not $sizes.Contains($opt)) { [void]$sizes.Add($opt) }
    }

    # descargar hasta 2 imagenes (frente + hover)
    $localImgs = New-Object System.Collections.ArrayList
    $maxImgs = [Math]::Min(2, $p.images.Count)
    for ($i = 0; $i -lt $maxImgs; $i++) {
        $src = $p.images[$i].src
        $clean = $src.Split("?")[0]
        $ext = [System.IO.Path]::GetExtension($clean)
        if (-not $ext) { $ext = ".jpg" }
        $fname = "$($p.handle)-$i$ext"
        $fpath = "$imgDir\$fname"
        if (-not (Test-Path $fpath)) {
            try { Invoke-WebRequest -Uri $src -OutFile $fpath -UseBasicParsing -TimeoutSec 30 } catch { continue }
        }
        [void]$localImgs.Add("images/productos/$fname")
    }
    if ($localImgs.Count -eq 0) { continue }

    $desc = Clean-Description $p.body_html

    $obj = [ordered]@{
        id          = $p.handle
        title       = $p.title
        price       = $price
        priceNum    = [int]([double]$priceRaw)
        category    = $cat
        available   = $available
        sizes       = @($sizes)
        images      = @($localImgs)
        description = $desc
    }
    [void]$out.Add($obj)
    $count++
}

$json = $out | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText("$dir\data\products.json", $json, $utf8)

"Productos exportados: $count"
$out | Group-Object category | Sort-Object Count -Descending | ForEach-Object { "  $($_.Name): $($_.Count)" }