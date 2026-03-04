$enc = New-Object System.Text.UTF8Encoding $false
$sidebarLinks = @(
    @{ id = 'index'; name = 'Home'; icon = 'home' },
    @{ id = 'cardgen'; name = 'Card Gen'; icon = 'credit-card' },
    @{ id = 'fake-address'; name = 'Fake Address'; icon = 'map-pin' },
    @{ id = 'password'; name = 'Password Gen'; icon = 'key' },
    @{ id = 'prefix'; name = 'Suffix & Prefix'; icon = 'hash' },
    @{ id = 'bin'; name = 'BIN Checker'; icon = 'search' },
    @{ id = 'tempmail'; name = 'Temp Mail'; icon = 'mail' },
    @{ id = 'json'; name = 'JSON Formatter'; icon = 'code' },
    @{ id = 'base64'; name = 'Base64'; icon = 'file-text' },
    @{ id = 'hash'; name = 'Hash Gen'; icon = 'lock' },
    @{ id = 'url'; name = 'URL Tools'; icon = 'link' },
    @{ id = 'short'; name = 'URL Shortener'; icon = 'scissors' },
    @{ id = 'ip'; name = 'IP Lookup'; icon = 'globe' },
    @{ id = 'regex'; name = 'Regex Tester'; icon = 'terminal' },
    @{ id = 'lorem'; name = 'Lorem Ipsum'; icon = 'type' }
)

function Get-Sidebar {
    param([string]$currentId)
    $html = "        <nav class=`"sidebar-nav`">`n"
    foreach ($link in $sidebarLinks) {
        $activeClass = if ($link.id -eq $currentId) { " active" } else { "" }
        $html += "            <a href=`"$($link.id)`" class=`"nav-item$activeClass`">`n"
        $html += "                <i data-feather=`"$($link.icon)`"></i> $($link.name)`n"
        $html += "            </a>`n"
    }
    $html += "        </nav>"
    return $html
}

$files = Get-ChildItem -Filter *.html
foreach ($file in $files) {
    if ($file.Name -match "output") { continue }
    $fileId = $file.BaseName
    Try {
        $content = [System.IO.File]::ReadAllText($file.FullName, $enc)
    }
    Catch {
        # Fallback to UTF8 detection
        $content = [System.IO.File]::ReadAllText($file.FullName)
    }

    $sidebar = Get-Sidebar -currentId $fileId
    $content = $content -replace '(?s)<nav class="sidebar-nav">.*?</nav>', $sidebar

    # replace href="xxx.html" with href="xxx" (must match internal files explicitly)
    $content = [regex]::Replace($content, 'href="([a-zA-Z0-9-]+)\.html"', 'href="$1"')

    [System.IO.File]::WriteAllText($file.FullName, $content, $enc)
    Write-Host "Processed $($file.Name)"
}
