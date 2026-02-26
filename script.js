// Custom Alert Logic
function showAlert(msg, isError = false) {
    const alertBox = document.getElementById('customAlert');
    const title = document.getElementById('alertTitle');
    const message = document.getElementById('alertMsg');

    if (isError) {
        alertBox.classList.add('error');
        title.innerText = ">> SYSTEM ERROR <<";
    } else {
        alertBox.classList.remove('error');
        title.innerText = ">> SUCCESS <<";
    }

    message.innerText = msg;
    alertBox.style.display = 'block';

    setTimeout(() => {
        alertBox.style.display = 'none';
    }, 3000);
}

// Populate Years dynamically up to 2050
window.onload = function () {
    const yearList = document.getElementById('years');
    // yearList might not exist on all pages (e.g., bin checker)
    if (yearList) {
        const currentYear = new Date().getFullYear();
        for (let y = currentYear; y <= 2050; y++) {
            let opt = document.createElement('option');
            opt.value = y;
            yearList.appendChild(opt);
        }
    }

    // Hide .html extension from URL
    if (window.location.pathname.endsWith('.html')) {
        let newUrl = window.location.pathname.slice(0, -5);
        // Special case for index.html -> KaziTools
        if (newUrl.endsWith('/index')) {
            newUrl = newUrl.slice(0, -6) + '/KaziTools';
        } else if (newUrl === 'index') {
            newUrl = 'KaziTools';
        }
        if (window.location.search) newUrl += window.location.search;
        if (window.location.hash) newUrl += window.location.hash;
        window.history.replaceState(null, '', newUrl);
    }
};

// Security: Disable Right Click
document.addEventListener('contextmenu', event => event.preventDefault());

// Security: Disable Developer Tools Keyboard Shortcuts
document.addEventListener('keydown', function (e) {
    // F12
    if (e.key === 'F12') {
        e.preventDefault();
    }
    // Ctrl+Shift+I / Cmd+Option+I (DevTools)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
    }
    // Ctrl+Shift+J / Cmd+Option+J (Console)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
        e.preventDefault();
    }
    // Ctrl+Shift+C / Cmd+Shift+C (Inspect Element)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
    }
    // Ctrl+U / Cmd+U (View Source)
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
    }
});

function generateLuhnDigit(partialCardNum) {
    let sum = 0;
    let shouldDouble = true;
    for (let i = partialCardNum.length - 1; i >= 0; i--) {
        let digit = parseInt(partialCardNum.charAt(i));
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return (10 - (sum % 10)) % 10;
}

function validateLuhn(cardNum) {
    let card = cardNum.replace(/\D/g, '');
    if (!card) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = card.length - 1; i >= 0; i--) {
        let digit = parseInt(card.charAt(i));
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return (sum % 10) === 0;
}

// New Quality Check
function isCardPatternQualitative(cardNum) {
    if (/(\d)\1{4,}/.test(cardNum)) return false;
    const sequentials = ['123456', '234567', '345678', '456789', '987654', '876543'];
    for (let seq of sequentials) {
        if (cardNum.includes(seq)) return false;
    }
    return true;
}

function generateCard(patternInput) {
    let pattern = patternInput.toLowerCase().trim();

    let targetLen = 16;
    if (pattern.startsWith('34') || pattern.startsWith('37')) {
        targetLen = 15;
    } else if (pattern.startsWith('300') || pattern.startsWith('301') || pattern.startsWith('302') ||
        pattern.startsWith('303') || pattern.startsWith('304') || pattern.startsWith('305') ||
        pattern.startsWith('309') || pattern.startsWith('36') || pattern.startsWith('38') ||
        pattern.startsWith('39')) {
        // Diners Club
        targetLen = 14;
    }

    // Standardize length based on patterns, allowing user-provided bins to retain longer lengths 
    // if they supplied more specifically.
    while (pattern.length < targetLen) {
        pattern += 'x';
    }

    let cardNum = "";
    let attempts = 0;

    while (attempts < 50) {
        let tempCard = "";
        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i] === 'x') {
                tempCard += Math.floor(Math.random() * 10);
            } else if (!isNaN(parseInt(pattern[i]))) {
                tempCard += pattern[i];
            }
        }
        let preCheckString = tempCard.substring(0, tempCard.length - 1);
        if (pattern[pattern.length - 1] === 'x') {
            let checkDigit = generateLuhnDigit(preCheckString);
            cardNum = preCheckString + checkDigit;
        } else {
            cardNum = tempCard;
        }

        if (validateLuhn(cardNum) && isCardPatternQualitative(cardNum)) {
            return cardNum;
        }
        attempts++;
    }
    return cardNum;
}

// Copy Helper Functions
function copyTextToClipboard(text, isSingle) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showAlert(isSingle ? "CARD COPIED!" : "ALL DATA COPIED!");
        }).catch(() => fallbackCopy(text, isSingle));
    } else {
        fallbackCopy(text, isSingle);
    }
}

function fallbackCopy(text, isSingle) {
    let temp = document.createElement("textarea");
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
    showAlert(isSingle ? "CARD COPIED!" : "ALL DATA COPIED!");
}

function generateBulk() {
    const patternInput = document.getElementById('binInput').value;
    const qty = document.getElementById('quantity').value;
    const mInput = document.getElementById('monthInput').value || "Random";
    const yInput = document.getElementById('yearInput').value || "Random";

    const format = document.getElementById('formatInput').value;
    const outputContainer = document.getElementById('outputContainer');
    const outputHidden = document.getElementById('outputHidden');

    if (!patternInput || patternInput.length < 6) {
        showAlert("INVALID BIN LENGTH (MIN 6)", true);
        return;
    }

    const firstDigit = patternInput.charAt(0);
    if ('012789'.includes(firstDigit)) {
        showAlert("UNSUPPORTED NETWORK PREFIX", true);
        return;
    }

    outputContainer.innerHTML = ''; // Clear container

    let allText = "";
    let jsonItems = [];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    for (let i = 0; i < qty; i++) {
        const cardNumber = generateCard(patternInput);

        let yy = yInput;
        if (yy.toLowerCase() === "random") {
            yy = Math.floor(Math.random() * 5) + currentYear;
        } else {
            yy = parseInt(yy);
            if (yy < 100) yy += 2000;
        }

        let mm = mInput;
        if (mm.toLowerCase() === "random") {
            let minMonth = 1;
            if (yy === currentYear) {
                minMonth = currentMonth;
            }
            const month = Math.floor(Math.random() * (12 - minMonth + 1)) + minMonth;
            mm = month < 10 ? '0' + month : '' + month;
        } else {
            if (!isNaN(mm)) {
                if (parseInt(mm) < 10 && mm.length < 2) mm = '0' + parseInt(mm);
                else mm = '' + parseInt(mm);
            }
        }

        let cvvLength = (cardNumber.startsWith('34') || cardNumber.startsWith('37')) ? 4 : 3;
        let cvv = "";
        for (let j = 0; j < cvvLength; j++) {
            cvv += Math.floor(Math.random() * 10);
        }

        let rowText = "";
        let copyText = "";

        if (format === 'json') {
            let obj = { card: cardNumber, month: mm, year: yy, cvv: cvv };
            jsonItems.push(obj);
            rowText = JSON.stringify(obj);
            copyText = rowText; // For single JSON copy, it will copy the object
        } else if (format === 'sql') {
            rowText = `INSERT INTO cards VALUES ('${cardNumber}', '${mm}', '${yy}', '${cvv}');`;
            copyText = rowText;
        } else {
            let sep = '|';
            if (format === 'colon') sep = ':';
            if (format === 'csv') sep = ',';
            if (format === 'slash') sep = '/';
            if (format === 'space') sep = ' '; // Added space option

            rowText = `${cardNumber}${sep}${mm}${sep}${yy}${sep}${cvv}`;
            copyText = rowText;
        }

        // Append purely functional UI per item
        const rowDiv = document.createElement('div');
        rowDiv.className = 'result-row';

        const textSpan = document.createElement('span');
        textSpan.className = 'result-text';
        textSpan.innerText = rowText;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-copy-single';
        copyBtn.innerText = 'COPY';
        copyBtn.onclick = () => {
            copyTextToClipboard(copyText, true);
        };

        rowDiv.appendChild(textSpan);
        rowDiv.appendChild(copyBtn);
        outputContainer.appendChild(rowDiv);
    }

    if (format === 'json') {
        allText = JSON.stringify(jsonItems, null, 2);
    } else {
        let rows = document.querySelectorAll('.result-text');
        let arr = Array.from(rows).map(r => r.innerText);
        allText = arr.join('\n');
    }

    outputHidden.value = allText;
}

function copyAll() {
    const allText = document.getElementById('outputHidden').value;
    if (!allText) {
        showAlert("NO DATA TO COPY", true);
        return;
    }
    copyTextToClipboard(allText, false);
}
