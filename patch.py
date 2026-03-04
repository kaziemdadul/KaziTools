import io

with io.open('index.html', 'r', encoding='utf-16le') as f:
    content = f.read()

# Replace sidebar link
sidebar_target = """            <a href="cardgen.html" class="nav-item">
                <i data-feather="credit-card"></i> Card Gen
            </a>
            <a href="password.html" class="nav-item">"""

sidebar_replacement = """            <a href="cardgen.html" class="nav-item">
                <i data-feather="credit-card"></i> Card Gen
            </a>
            <a href="fake-address.html" class="nav-item">
                <i data-feather="map-pin"></i> Fake Address
            </a>
            <a href="password.html" class="nav-item">"""

content = content.replace(sidebar_target, sidebar_replacement)

# Replace tool card
card_target = """                    <a href="cardgen.html" class="tool-card">
                        <div class="tool-icon">&lt;C/G&gt;</div>
                        <div class="tool-title">Card Generator</div>
                        <div class="tool-desc">Generate secure simulated payment datasets based on BIN or custom
                            patterns.</div>
                    </a>

                    <a href="password.html" class="tool-card">"""

card_replacement = """                    <a href="cardgen.html" class="tool-card">
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

                    <a href="password.html" class="tool-card">"""

content = content.replace(card_target, card_replacement)

with io.open('index.html', 'w', encoding='utf-16le') as f:
    f.write(content)

print("Patch applied")
