const fs = require('fs');
const path = require('path');

const dir = '.';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const sidebarLinks = [
    { id: 'index', name: 'Home', icon: 'home' },
    { id: 'cardgen', name: 'Card Gen', icon: 'credit-card' },
    { id: 'fake-address', name: 'Fake Address', icon: 'map-pin' },
    { id: 'password', name: 'Password Gen', icon: 'key' },
    { id: 'prefix', name: 'Suffix & Prefix', icon: 'hash' },
    { id: 'bin', name: 'BIN Checker', icon: 'search' },
    { id: 'tempmail', name: 'Temp Mail', icon: 'mail' },
    { id: 'json', name: 'JSON Formatter', icon: 'code' },
    { id: 'base64', name: 'Base64', icon: 'file-text' },
    { id: 'hash', name: 'Hash Gen', icon: 'lock' },
    { id: 'url', name: 'URL Tools', icon: 'link' },
    { id: 'short', name: 'URL Shortener', icon: 'scissors' },
    { id: 'ip', name: 'IP Lookup', icon: 'globe' },
    { id: 'regex', name: 'Regex Tester', icon: 'terminal' },
    { id: 'lorem', name: 'Lorem Ipsum', icon: 'type' }
];

function generateSidebar(currentFileId) {
    let html = '        <nav class="sidebar-nav">\n';
    for (const link of sidebarLinks) {
        const activeClass = link.id === currentFileId ? ' active' : '';
        html += `            <a href="${link.id}" class="nav-item${activeClass}">\n`;
        html += `                <i data-feather="${link.icon}"></i> ${link.name}\n`;
        html += `            </a>\n`;
    }
    html += '        </nav>';
    return html;
}

let changedCount = 0;

for (const file of files) {
    const fileId = path.basename(file, '.html');
    let content = fs.readFileSync(path.join(dir, file), 'utf8');

    // Remove BOM if present inside string logic
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }

    // 1. Replace the entire <nav class="sidebar-nav"> ... </nav>
    const navRegex = /<nav class="sidebar-nav">[\s\S]*?<\/nav>/;
    const newSidebar = generateSidebar(fileId);

    if (navRegex.test(content)) {
        content = content.replace(navRegex, newSidebar);
    } else {
        console.warn(`Could not find <nav class="sidebar-nav"> in ${file}`);
    }

    // 2. Strip .html extension from internal links globally
    content = content.replace(/href="([a-zA-Z0-9-]+)\.html"/g, 'href="$1"');

    // Write back
    fs.writeFileSync(path.join(dir, file), content, 'utf8');
    changedCount++;
}

console.log(`Successfully processed ${changedCount} HTML files.`);
