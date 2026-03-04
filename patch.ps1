$content = [System.IO.File]::ReadAllText("index.html", [System.Text.Encoding]::Unicode)

$sidebarTarget = @"
            <a href="cardgen.html" class="nav-item">
                <i data-feather="credit-card"></i> Card Gen
            </a>
            <a href="password.html" class="nav-item">
"@

$sidebarReplacement = @"
            <a href="cardgen.html" class="nav-item">
                <i data-feather="credit-card"></i> Card Gen
            </a>
            <a href="fake-address.html" class="nav-item">
                <i data-feather="map-pin"></i> Fake Address
            </a>
            <a href="password.html" class="nav-item">
"@

$content = $content.Replace($sidebarTarget, $sidebarReplacement)

$cardTarget = @"
                    <a href="cardgen.html" class="tool-card">
                        <div class="tool-icon">&lt;C/G&gt;</div>
                        <div class="tool-title">Card Generator</div>
                        <div class="tool-desc">Generate secure simulated payment datasets based on BIN or custom
                            patterns.</div>
                    </a>

                    <a href="password.html" class="tool-card">
"@

$cardReplacement = @"
                    <a href="cardgen.html" class="tool-card">
                        <div class="tool-icon">&lt;C/G&gt;</div>
                        <div class="tool-title">Card Generator</div>
                        <div class="tool-desc">Generate secure simulated payment datasets based on BIN or custom
                            patterns.</div>
                    </a>

                    <a href="fake-address.html" class="tool-card">
                        <div class="tool-icon" style="background: rgba(236, 72, 153, 0.1); color: #ec4899;"><i data-feather="map-pin"></i></div>
                        <div class="tool-title">Fake Address</div>
                        <div class="tool-desc">Generate realistic random user data including names, addresses, across global regions.</div>
                    </a>

                    <a href="password.html" class="tool-card">
"@

$content = $content.Replace($cardTarget, $cardReplacement)

[System.IO.File]::WriteAllText("index.html", $content, [System.Text.Encoding]::Unicode)
Write-Output "Patch applied"
