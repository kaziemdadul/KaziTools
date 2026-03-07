// Configuration
const APIS = {
    'mail.tm': 'https://api.mail.tm',
    'mail.gw': 'https://api.mail.gw',
    'tempmaillab': '/api/tempmaillab'
};
const POLL_INTERVAL = 10000; // 10 seconds

// State
let currentEmail = '';
let currentToken = '';
let currentAccountId = '';
let currentApi = ''; // 'mail.tm' or 'mail.gw'
let lastAutoApi = ''; // Keep track of last used auto API for round-robin
let emails = [];
let availableDomains = []; // Array of objects: { domain: 'example.com', api: 'mail.tm' }
let pollTimer = null;
let countdownTimer = null;
let countdownSeconds = 10;
let isDarkTheme = true;
let isGenerating = false;
let emailHistory = []; // Array of { email, password, api, accountId, token, createdAt }
let historyCurrentPage = 1;
const historyItemsPerPage = 5;

// DOM Elements
const els = {
    emailAddress: document.getElementById('email-address'),
    emailLoader: document.getElementById('email-loader'),
    emailWrapper: document.getElementById('email-wrapper'),
    copyBtn: document.getElementById('copy-btn'),
    refreshBtn: document.getElementById('refresh-address-btn'),
    createBtn: document.getElementById('create-btn'),
    checkMailBtn: document.getElementById('check-mail-btn'),
    domainSelect: document.getElementById('domain-select'),
    customPasswordInput: document.getElementById('custom-password-input'),
    customPrefixInput: document.getElementById('custom-prefix-input'),

    inboxEmpty: document.getElementById('inbox-empty'),
    inboxLoader: document.getElementById('inbox-loader'),
    inboxList: document.getElementById('inbox-list'),
    emailCount: document.getElementById('email-count'),

    modal: document.getElementById('email-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    modalSubject: document.getElementById('modal-subject'),
    modalFrom: document.getElementById('modal-from'),
    modalDate: document.getElementById('modal-date'),
    modalBodyLoader: document.getElementById('modal-body-loader'),
    modalContentFrame: document.getElementById('modal-content-frame'),

    themeToggle: document.getElementById('theme-toggle'),
    historyList: document.getElementById('history-list'),
    historyEmpty: document.getElementById('history-empty'),
    historyPrevBtn: document.getElementById('history-prev-btn'),
    historyNextBtn: document.getElementById('history-next-btn'),
    historyCount: document.getElementById('history-count'),
    historyPageInfo: document.getElementById('history-page-info'),
    toastContainer: document.getElementById('toast-container'),

    // New Features
    deleteBtn: document.getElementById('delete-btn'),
    countdownSpan: document.getElementById('countdown'),
    copyBodyBtn: document.getElementById('copy-body-btn'),
    extractLinksBtn: document.getElementById('extract-links-btn'),

    // Custom Confirm Modal
    confirmModal: document.getElementById('confirm-modal'),
    confirmMessage: document.getElementById('confirm-message'),
    confirmOkBtn: document.getElementById('confirm-ok-btn'),
    confirmCancelBtn: document.getElementById('confirm-cancel-btn'),

    // Original global ref for later access
    currentMessageCache: null
};

// Initialize App
async function init() {
    loadHistory();
    loadTheme();
    setupEventListeners();
    await fetchDomains();

    // mail.tm/mail.gw requires an account (address + password) to access the inbox.
    // We will save the token in localStorage.
    const savedToken = localStorage.getItem('dropmail_token');
    const savedEmail = localStorage.getItem('dropmail_address');
    const savedAccountId = localStorage.getItem('dropmail_account_id');
    const savedApi = localStorage.getItem('dropmail_api');

    if (savedToken && savedEmail && savedAccountId && savedApi) {
        currentToken = savedToken;
        currentEmail = savedEmail;
        currentAccountId = savedAccountId;
        currentApi = savedApi;

        showEmail(currentEmail);
        fetchMessages();
        startPolling();
    } else {
        await generateNewEmail();
    }
}

// Event Listeners
function setupEventListeners() {
    els.copyBtn.addEventListener('click', () => copyToClipboard(currentEmail));

    // The main random generate button
    els.refreshBtn.addEventListener('click', () => {
        els.customPrefixInput.value = ''; // clear input to force random
        generateNewEmail();
    });

    // The specific create button next to the input
    els.createBtn.addEventListener('click', generateNewEmail);

    // Also support pressing Enter in the input box
    els.customPrefixInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') generateNewEmail();
    });

    els.checkMailBtn.addEventListener('click', () => {
        showToast('Checking for new emails...', 'info');
        fetchMessages();
    });

    els.closeModalBtn.addEventListener('click', closeModal);

    if (els.deleteBtn) els.deleteBtn.addEventListener('click', deleteAccount);
    if (els.copyBodyBtn) els.copyBodyBtn.addEventListener('click', copyModalBody);
    if (els.extractLinksBtn) els.extractLinksBtn.addEventListener('click', extractModalLinks);

    // Fallback for modal backdrop click
    if (els.modal) {
        els.modal.addEventListener('click', (e) => {
            if (e.target === els.modal) closeModal();
        });
    }

    if (els.themeToggle) els.themeToggle.addEventListener('click', toggleTheme);
}

// API Functions
async function fetchDomains() {
    availableDomains = [];

    // Fetch from all APIS concurrently
    const apiKeys = Object.keys(APIS);

    try {
        const fetchPromises = apiKeys.map(async (apiKey) => {
            try {
                const response = await fetch(`${APIS[apiKey]}/domains`);
                if (response.ok) {
                    const data = await response.json();
                    let activeDomains = [];
                    if (apiKey === 'tempmaillab') {
                        activeDomains = (data.domains || []).map(d => ({
                            domain: d,
                            api: apiKey
                        }));
                    } else {
                        activeDomains = (data['hydra:member'] || []).filter(d => d.isActive).map(d => ({
                            domain: d.domain,
                            api: apiKey
                        }));
                    }
                    availableDomains.push(...activeDomains);
                }
            } catch (err) {
                console.warn(`Failed to fetch domains from ${apiKey}`, err);
            }
        });

        await Promise.all(fetchPromises);

        if (availableDomains.length === 0) {
            throw new Error('All APIs failed to return domains');
        }

        populateDomainDropdown();
    } catch (error) {
        console.error('Failed to load domains:', error);
        showToast('Warning: Could not load domain list', 'error');
    }
}

function populateDomainDropdown() {
    // Keep the "Auto-Select" option, remove the rest
    while (els.domainSelect.options.length > 1) {
        els.domainSelect.remove(1);
    }

    availableDomains.forEach(domainObj => {
        const option = document.createElement('option');
        option.value = domainObj.domain;
        option.textContent = `@${domainObj.domain}`;
        els.domainSelect.appendChild(option);
    });
}

async function generateNewEmail() {
    if (isGenerating) return;
    isGenerating = true;

    // Disable buttons
    if (els.refreshBtn) els.refreshBtn.disabled = true;
    if (els.createBtn) els.createBtn.disabled = true;
    if (els.customPrefixInput) els.customPrefixInput.disabled = true;

    stopPolling();
    els.emailWrapper.classList.add('hidden');
    els.emailLoader.classList.remove('hidden');

    try {
        // Silently delete previously active account to prevent rate limits
        if (currentAccountId && currentToken && currentApi) {
            try {
                await fetch(`${APIS[currentApi]}/accounts/${currentAccountId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${currentToken}` }
                });
            } catch (ignore) { }
            // Don't clear localStorage yet, it will be overwritten if successful
        }

        // 1. Get available domains if not fetched
        if (availableDomains.length === 0) {
            await fetchDomains();
        }

        if (availableDomains.length === 0) {
            throw new Error('All APIs failed to return domains');
        }

        // 2. Determine credentials
        let selectedDomain = els.domainSelect.value;
        let selectedPrefix = els.customPrefixInput.value.trim().toLowerCase();
        let targetApi = '';
        let isAutoSelect = false;

        const selectedDomainObj = availableDomains.find(d => d.domain === selectedDomain);

        if (selectedDomain === 'auto' || !selectedDomainObj) {
            isAutoSelect = true;

            // Round-robin selection between APIs to mitigate rate limits
            const apiKeys = Object.keys(APIS);

            // Determine the next API to use (flip between mail.tm and mail.gw)
            if (!lastAutoApi) {
                lastAutoApi = apiKeys[0];
            } else {
                const currentIndex = apiKeys.indexOf(lastAutoApi);
                lastAutoApi = apiKeys[(currentIndex + 1) % apiKeys.length];
            }
            targetApi = lastAutoApi;

            // Pick a random domain belonging to the chosen targetAPI
            const domainsForTargetApi = availableDomains.filter(d => d.api === targetApi);

            if (domainsForTargetApi.length > 0) {
                selectedDomain = domainsForTargetApi[Math.floor(Math.random() * domainsForTargetApi.length)].domain;
            } else {
                // Fallback if the target API somehow has no domains, just pick any random one
                const randomDomainObj = availableDomains[Math.floor(Math.random() * availableDomains.length)];
                selectedDomain = randomDomainObj.domain;
                targetApi = randomDomainObj.api;
                lastAutoApi = targetApi;
            }
        } else {
            targetApi = selectedDomainObj.api;
        }

        // Clean prefix (only letters, numbers, and some basic chars allowed usually)
        selectedPrefix = selectedPrefix.replace(/[^a-z0-9.-]/g, '');

        if (!selectedPrefix) {
            // Auto-generate if empty
            selectedPrefix = Math.random().toString(36).substring(2, 10);
        }

        let address = `${selectedPrefix}@${selectedDomain}`;
        let customPassword = els.customPasswordInput ? els.customPasswordInput.value.trim() : ""; const password = customPassword ? customPassword : Math.random().toString(36).substring(2, 15);

        // 3. Create account
        let isExistingAccount = false;
        let accountData = null;
        let createRes = null;

        if (targetApi === 'tempmaillab') {
            createRes = await fetch(`${APIS[targetApi]}/change_email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ localPart: selectedPrefix, domain: selectedDomain, random: false })
            });

            if (!createRes.ok) {
                if (createRes.status === 429) {
                    throw new Error('Too many requests (rate limit). Please wait a moment.');
                }
                throw new Error('Failed to create account on tempmaillab. Domain might be full.');
            }

            const data = await createRes.json();
            currentEmail = data.email || address;
            currentToken = data.token;
            currentAccountId = 'tempmaillab_' + Date.now();
            currentApi = targetApi;
        } else {
            createRes = await fetch(`${APIS[targetApi]}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, password })
            });

            // Auto-Retry logic for 429 specific to Auto-Select
            if (!createRes.ok && createRes.status === 429 && isAutoSelect) {
                console.warn(`Rate limit hit on ${targetApi}. Falling back to alternate API...`);

                // Swap to the other API
                const otherApi = Object.keys(APIS).find(api => api !== targetApi) || targetApi;

                if (otherApi !== targetApi) {
                    targetApi = otherApi;
                    lastAutoApi = targetApi; // Update the round-robin tracker

                    // Pick a new domain from the new target
                    const altDomains = availableDomains.filter(d => d.api === targetApi);
                    if (altDomains.length > 0) {
                        address = `${selectedPrefix}@${altDomains[Math.floor(Math.random() * altDomains.length)].domain}`;

                        // Retry fetch exactly once silently
                        createRes = await fetch(`${APIS[targetApi]}/accounts`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ address, password })
                        });
                    }
                }
            }

            if (!createRes.ok) {
                if (createRes.status === 429) {
                    throw new Error('Too many requests (rate limit). Please wait a moment.');
                }
                const errData = await createRes.json();
                if (createRes.status === 422 && errData['hydra:description'] && errData['hydra:description'].includes('already')) {
                    if (customPassword) {
                        isExistingAccount = true;
                    } else {
                        throw new Error('This exact email is already taken. Try a different name.');
                    }
                } else {
                    throw new Error('Failed to create account');
                }
            }
            if (!isExistingAccount) {
                accountData = await createRes.json();
            }

            // 4. Login to get token
            const tokenRes = await fetch(`${APIS[targetApi]}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address, password })
            });
            if (!tokenRes.ok) {
                if (isExistingAccount) {
                    throw new Error('Incorrect password or email combination.');
                } else {
                    throw new Error('Failed to get token');
                }
            }
            const tokenData = await tokenRes.json();

            // 5. Save state
            currentEmail = address;
            currentToken = tokenData.token;
            if (isExistingAccount) {
                const meRes = await fetch(`${APIS[targetApi]}/me`, {
                    headers: { 'Authorization': `Bearer ${currentToken}` }
                });
                if (meRes.ok) {
                    const meData = await meRes.json();
                    currentAccountId = meData.id;
                } else {
                    currentAccountId = 'unknown'; // fallback
                }
            } else {
                currentAccountId = accountData.id;
            }
            currentApi = targetApi;
        }

        localStorage.setItem('dropmail_token', currentToken);
        localStorage.setItem('dropmail_address', currentEmail);
        localStorage.setItem('dropmail_account_id', currentAccountId);
        localStorage.setItem('dropmail_api', currentApi);

        // Save to History (if new or login)
        let historyObj = { email: address, password: customPassword || password, api: targetApi, accountId: currentAccountId, token: currentToken, createdAt: new Date().toISOString() };
        saveToHistory(historyObj);

        // Reset inbox
        emails = [];
        updateInboxUI();

        showEmail(currentEmail);
        showToast('New email address generated', 'success');

        startPolling();
    } catch (error) {
        console.error('Failed to generate email:', error);
        showToast(error.message || 'Failed to generate email address', 'error');
        els.emailLoader.classList.add('hidden');
    } finally {
        isGenerating = false;
        if (els.refreshBtn) els.refreshBtn.disabled = false;
        if (els.createBtn) els.createBtn.disabled = false;
        if (els.customPrefixInput) els.customPrefixInput.disabled = false;
    }
}

async function fetchMessages() {
    if (!currentToken) return;

    // Reset countdown
    countdownSeconds = 10;
    if (els.countdownSpan) els.countdownSpan.textContent = `NEXT CHECK: 10s`;

    // Auto refresh badge icon spin manually 
    const spinIcon = document.querySelector('.auto-refresh-indicator i');
    if (spinIcon) {
        spinIcon.style.animationDuration = '0.5s';
        setTimeout(() => spinIcon.style.animationDuration = '2s', 1000);
    }

    try {
        const fetchUrl = currentApi === 'tempmaillab' ? `${APIS[currentApi]}/inbox` : `${APIS[currentApi]}/messages`;
        const response = await fetch(fetchUrl, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        if (response.status === 401) {
            // Token expired or invalid, clear and generate new
            localStorage.removeItem('dropmail_token');
            localStorage.removeItem('dropmail_address');
            localStorage.removeItem('dropmail_account_id');
            localStorage.removeItem('dropmail_api'); // Also remove API
            await generateNewEmail();
            return;
        }

        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        let messages = [];

        if (currentApi === 'tempmaillab') {
            const rawMessages = Array.isArray(data) ? data : (data.messages || []);
            messages = rawMessages.map((m, i) => {
                const htmlContent = m.body_html || m.html;
                const textContent = m.body_text || m.text || m.body || '';
                return {
                    id: m.id || m.uid || `msg-${Date.now()}-${i}`,
                    from: { address: m.sender || m.from || 'Unknown', name: '' },
                    subject: m.subject || '(No Subject)',
                    createdAt: m.date || new Date().toISOString(),
                    text: textContent,
                    html: htmlContent ? [htmlContent] : [textContent]
                };
            });
        } else {
            messages = data['hydra:member'] || [];
        }

        // Check if there are new messages
        if (messages.length > emails.length && emails.length > 0) {
            showToast('New email received!', 'success');
        }

        emails = messages;
        updateInboxUI();
    } catch (error) {
        console.error('Failed to fetch messages:', error);
    }
}

async function fetchMessageDetails(id) {
    if (!currentToken || !currentApi) return null;

    if (currentApi === 'tempmaillab') {
        const cachedMsg = emails.find(e => e.id === id);
        return cachedMsg || null;
    }

    try {
        const response = await fetch(`${APIS[currentApi]}/messages/${id}`, {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!response.ok) throw new Error('API Error');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch message details:', error);
        showToast('Failed to load message', 'error');
        return null;
    }
}

// Logic Functions

function startPolling() {
    stopPolling();
    // fetch every 10 seconds (10000ms), but we'll manage via a 1-second interval for countdown UI
    countdownSeconds = 10;
    if (els.countdownSpan) els.countdownSpan.textContent = `NEXT CHECK: 10s`;

    pollTimer = setInterval(() => {
        countdownSeconds--;
        if (countdownSeconds <= 0) {
            fetchMessages();
            // fetchMessages will reset countdownSeconds
        } else {
            if (els.countdownSpan) els.countdownSpan.textContent = `NEXT CHECK: ${countdownSeconds.toString().padStart(2, '0')}s`;
        }
    }, 1000);
}

function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
}

async function deleteAccount() {
    if (!currentToken || !currentAccountId || !currentApi) {
        showToast("No active account to delete.", "error");
        return;
    }

    const confirmed = await showConfirm(`Are you sure you want to completely BURN this address (${currentEmail}) and clear the inbox forever?`);
    if (!confirmed) {
        return;
    }

    // Disable button to prevent double-click
    if (els.deleteBtn) {
        els.deleteBtn.disabled = true;
        els.deleteBtn.textContent = "BURNING...";
    }

    stopPolling();

    try {
        await fetch(`${APIS[currentApi]}/accounts/${currentAccountId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        showToast(`Address deleted.`, 'success');

        // Clear local storage completely
        localStorage.removeItem('dropmail_token');
        localStorage.removeItem('dropmail_address');
        localStorage.removeItem('dropmail_account_id');
        localStorage.removeItem('dropmail_api');

        currentEmail = '';
        currentToken = '';
        currentAccountId = '';

        // Reset button
        if (els.deleteBtn) {
            els.deleteBtn.disabled = false;
            els.deleteBtn.textContent = "DELETE / BURN";
        }

        // Auto-generate fresh one immediately
        await generateNewEmail();

    } catch (err) {
        console.error("Failed to delete account:", err);
        showToast("Error deleting account. It may already be removed.", "error");
        if (els.deleteBtn) {
            els.deleteBtn.disabled = false;
            els.deleteBtn.textContent = "DELETE / BURN";
        }
    }
}

// UI Functions
function showEmail(email) {
    els.emailLoader.classList.add('hidden');
    els.emailAddress.value = email;
    els.emailWrapper.classList.remove('hidden');
}

function updateInboxUI() {
    els.emailCount.textContent = emails.length;

    if (emails.length === 0) {
        els.inboxEmpty.classList.remove('hidden');
        els.inboxList.classList.add('hidden');
    } else {
        els.inboxEmpty.classList.add('hidden');
        els.inboxList.classList.remove('hidden');

        // Render list
        els.inboxList.innerHTML = '';
        emails.forEach(email => {
            const el = document.createElement('div');
            el.className = 'result-row';

            // Format time
            const date = new Date(email.createdAt);
            const timeStr = isToday(date)
                ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                : date.toLocaleDateString([], { month: 'short', day: 'numeric' });

            // Sender initial
            const senderName = email.from.name || email.from.address;

            el.innerHTML = `
                <div class="result-text" style="flex: 1; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                    <span style="color: var(--primary); font-size: 12px; width: 50px; flex-shrink: 0;">[${timeStr}]</span> 
                    <span style="color: #fff; flex-shrink: 0; min-width: 80px;">${escapeHTML(senderName).substring(0, 15)}</span>
                    <span style="color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(email.subject || '(No Subject)')}</span>
                </div>
                <button class="btn-copy-single">READ</button>
            `;

            el.addEventListener('click', () => openEmail(email.id));
            els.inboxList.appendChild(el);
        });
    }
}

async function openEmail(id) {
    // Open loading modal
    els.modalSubject.textContent = 'Loading message...';
    els.modalFrom.textContent = '';
    els.modalDate.textContent = '';
    els.modalBodyLoader.classList.remove('hidden');
    els.modalContentFrame.classList.add('hidden');
    els.modalContentFrame.innerHTML = '';

    els.modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling

    // Fetch details
    const message = await fetchMessageDetails(id);
    if (!message) {
        closeModal();
        return;
    }

    els.currentMessageCache = message;

    els.modalSubject.textContent = message.subject || '(No Subject)';
    els.modalFrom.textContent = message.from.name ? `${message.from.name} <${message.from.address}>` : message.from.address;

    const date = new Date(message.createdAt);
    els.modalDate.textContent = date.toLocaleString();

    els.modalBodyLoader.classList.add('hidden');
    els.modalContentFrame.classList.remove('hidden');

    // Render content safely using an iframe without JS permissions
    if (message.html) {
        const iframe = document.createElement('iframe');
        iframe.sandbox = "allow-same-origin"; // Restrict scripts and popups
        els.modalContentFrame.appendChild(iframe);

        // Write content to iframe
        const doc = iframe.contentWindow.document;
        doc.open();
        // Inject some basic styling to make emails look okay in dark mode context
        // OR we can leave the modal-body as white background so emails look normal.
        // I've styled modal-body with white bg / black text.
        doc.write(`
            <style>
                body { font-family: sans-serif; padding: 10px; word-wrap: break-word; }
                img { max-width: 100%; height: auto; }
                a { color: #4f46e5; }
            </style>
            ${message.html[0]}
        `);
        doc.close();
    } else {
        // Plain text fallback
        const pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.fontFamily = 'inherit';
        pre.textContent = message.text || '(Empty message)';
        els.modalContentFrame.appendChild(pre);
    }
}

function closeModal() {
    els.modal.classList.remove('active');
    document.body.style.overflow = '';
    els.currentMessageCache = null;
}

// Custom Confirm Logic
function showConfirm(message) {
    return new Promise((resolve) => {
        if (!els.confirmModal || !els.confirmMessage || !els.confirmOkBtn || !els.confirmCancelBtn) {
            // fallback to native if elements missing for some reason
            resolve(confirm(message));
            return;
        }

        els.confirmMessage.textContent = message;
        els.confirmModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        const handleOk = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            els.confirmModal.style.display = 'none';
            document.body.style.overflow = '';
            els.confirmOkBtn.removeEventListener('click', handleOk);
            els.confirmCancelBtn.removeEventListener('click', handleCancel);
        };

        els.confirmOkBtn.addEventListener('click', handleOk);
        els.confirmCancelBtn.addEventListener('click', handleCancel);
    });
}

// Utilities

function copyModalBody() {
    if (!els.currentMessageCache) return;

    // If there's text, prefer text, otherwise try to strip HTML
    let textToCopy = els.currentMessageCache.text || '';

    if (!textToCopy && els.currentMessageCache.html) {
        // Simple HTML strip if no plain text version exists
        let tmp = document.createElement("DIV");
        // We can't safely use innerHTML to strip, we'll try a regex hack or rely on textContent if we inject it
        tmp.innerHTML = els.currentMessageCache.html[0];
        textToCopy = tmp.textContent || tmp.innerText || "";
    }

    if (textToCopy.trim().length === 0) {
        showToast("No text content available to copy.", "error");
        return;
    }

    copyToClipboard(textToCopy);
    if (els.copyBodyBtn) els.copyBodyBtn.textContent = "COPIED!";
    setTimeout(() => {
        if (els.copyBodyBtn) els.copyBodyBtn.textContent = "COPY BODY";
    }, 2000);
}

function extractModalLinks() {
    if (!els.currentMessageCache || !els.currentMessageCache.html) {
        showToast("No HTML content to extract links from.", "error");
        return;
    }

    const htmlStr = els.currentMessageCache.html[0];
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlStr, 'text/html');
    const aTags = doc.querySelectorAll('a');

    if (aTags.length === 0) {
        showToast("No links found in this message.", "error");
        return;
    }

    const links = Array.from(aTags).map(a => a.href).filter(href => href && href.startsWith('http'));

    if (links.length === 0) {
        showToast("No valid URLs found.", "error");
        return;
    }

    // Deduplicate
    const uniqueLinks = [...new Set(links)];
    const linksText = uniqueLinks.join('\n');

    copyToClipboard(linksText);
    if (els.extractLinksBtn) els.extractLinksBtn.textContent = `EXTRACTED ${uniqueLinks.length} LINKS!`;
    setTimeout(() => {
        if (els.extractLinksBtn) els.extractLinksBtn.textContent = "EXTRACT LINKS";
    }, 2000);
}
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Address copied to clipboard!', 'success');

        // Visual feedback on button
        const originalHTML = els.copyBtn.innerHTML;
        els.copyBtn.innerHTML = "COPIED!";
        setTimeout(() => {
            els.copyBtn.innerHTML = originalHTML;
        }, 2000);
    }).catch(err => {
        console.error('Could not copy text: ', err);
        showToast('Failed to copy', 'error');
    });
}

function showToast(message, type = 'info') {
    const alertBox = document.getElementById('customAlert');
    if (!alertBox) return; // fallback
    const alertTitle = document.getElementById('alertTitle');
    const alertMsg = document.getElementById('alertMsg');

    if (type === 'error') {
        alertBox.classList.add('error');
        if (alertTitle) alertTitle.textContent = ">> ERROR <<";
    } else {
        alertBox.classList.remove('error');
        if (alertTitle) alertTitle.textContent = ">> SYSTEM ALERT <<";
    }

    if (alertMsg) alertMsg.textContent = message;
    alertBox.style.display = 'block';

    setTimeout(() => {
        alertBox.style.display = 'none';
        alertBox.classList.remove('error');
    }, 3000);
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function isToday(date) {
    const today = new Date();
    return date.getDate() == today.getDate() &&
        date.getMonth() == today.getMonth() &&
        date.getFullYear() == today.getFullYear();
}

function loadHistory() {
    const historyJSON = localStorage.getItem('dropmail_history');
    if (historyJSON) {
        try {
            emailHistory = JSON.parse(historyJSON);
        } catch (e) { emailHistory = []; }
    }
    renderHistory();
}

function saveToHistory(newObj) {
    // Check if exists, remove to put at top
    emailHistory = emailHistory.filter(h => h.email !== newObj.email);
    emailHistory.unshift(newObj);
    localStorage.setItem('dropmail_history', JSON.stringify(emailHistory));
    renderHistory();
}

function renderHistory() {
    if (!els.historyList || !els.historyEmpty || !els.historyCount || !els.historyPageInfo) return;

    els.historyCount.textContent = emailHistory.length;

    if (emailHistory.length === 0) {
        els.historyEmpty.classList.remove('hidden');
        els.historyList.classList.add('hidden');
        els.historyPageInfo.textContent = "1 / 1";
        return;
    }

    els.historyEmpty.classList.add('hidden');
    els.historyList.classList.remove('hidden');

    const totalPages = Math.ceil(emailHistory.length / historyItemsPerPage) || 1;
    if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
    if (historyCurrentPage < 1) historyCurrentPage = 1;

    els.historyPageInfo.textContent = `${historyCurrentPage} / ${totalPages}`;

    const startIndex = (historyCurrentPage - 1) * historyItemsPerPage;
    const endIndex = startIndex + historyItemsPerPage;
    const itemsToRender = emailHistory.slice(startIndex, endIndex);

    els.historyList.innerHTML = '';

    itemsToRender.forEach(h => {
        const el = document.createElement('div');
        el.className = 'result-row';

        const date = new Date(h.createdAt);
        const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

        // Mark active
        const isActive = (h.email === currentEmail);
        const activeStyle = isActive ? 'border-left: 2px solid var(--accent); padding-left: 8px;' : '';
        const activeText = isActive ? '<span style="color: var(--accent); font-size: 10px; margin-right: 5px;">[ACTIVE]</span>' : '';

        el.innerHTML = `
            <div class="result-text" style="flex: 1; display: flex; align-items: center; gap: 10px; cursor: pointer; ${activeStyle}">
                <span style="color: var(--primary); font-size: 12px; width: 45px; flex-shrink: 0;">[${dateStr}]</span> 
                ${activeText}
                <span style="color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${h.email}</span>
            </div>
            <div style="display: flex; gap: 5px;">
                <button class="btn-copy-single" onclick="loginFromHistory('${h.email}')" style="background: transparent; border: 1px solid var(--primary); color: var(--primary);">USE</button>
                <button class="btn-copy-single" onclick="deleteFromHistory('${h.email}')" style="background: transparent; border: 1px solid var(--error); color: var(--error);">DEL</button>
            </div>
        `;

        els.historyList.appendChild(el);
    });
}

function changeHistoryPage(delta) {
    historyCurrentPage += delta;
    renderHistory();
}

if (els.historyPrevBtn) els.historyPrevBtn.addEventListener('click', () => changeHistoryPage(-1));
if (els.historyNextBtn) els.historyNextBtn.addEventListener('click', () => changeHistoryPage(1));

window.loginFromHistory = async function (email) {
    const histItem = emailHistory.find(h => h.email === email);
    if (!histItem) return;

    if (email === currentEmail) {
        showToast("Address is already active", "info");
        return;
    }

    if (els.customPrefixInput) els.customPrefixInput.value = "";
    if (els.customPasswordInput) els.customPasswordInput.value = histItem.password;

    // Set domain dropdown to match
    const domainPart = email.split('@')[1];
    if (els.domainSelect) els.domainSelect.value = domainPart;

    // Trigger generation login
    els.customPrefixInput.value = email.split('@')[0];
    await generateNewEmail();
};

window.deleteFromHistory = function (email) {
    if (email === currentEmail) {
        showToast("Cannot delete currently active address from history.", "error");
        return;
    }
    emailHistory = emailHistory.filter(h => h.email !== email);
    localStorage.setItem('dropmail_history', JSON.stringify(emailHistory));
    renderHistory();
    showToast("Address removed from history.", "success");
};

function loadTheme() {
    const savedTheme = localStorage.getItem('dropmail_theme');
    if (savedTheme === 'light') {
        isDarkTheme = false;
        document.body.setAttribute('data-theme', 'light');
        els.themeToggle.innerHTML = "<i class='bx bx-sun'></i>";
    }
}

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    if (isDarkTheme) {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('dropmail_theme', 'dark');
        els.themeToggle.innerHTML = "<i class='bx bx-moon'></i>";
    } else {
        document.body.setAttribute('data-theme', 'light');
        localStorage.setItem('dropmail_theme', 'light');
        els.themeToggle.innerHTML = "<i class='bx bx-sun'></i>";
    }
}

// Boot the app
document.addEventListener('DOMContentLoaded', init);

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
