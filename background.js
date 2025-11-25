// 2. YOUR SPECIFIC MODEL SETTING
const MODEL_NAME = "gemini-2.5-flash"; 

// Helper: Send Logs to Console
function logToTab(tabId, message, data = null) {
    if (tabId) {
        chrome.tabs.sendMessage(tabId, { action: "logProxy", message: message, data: data }).catch(() => {});
    }
}

// Helper: Send Progress Bar Updates
function updateProgress(tabId, text, percent) {
    if (tabId) {
        chrome.tabs.sendMessage(tabId, { action: "updateStatus", text: text, percent: percent }).catch(() => {});
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyzeGemini") {
        const tabId = sender.tab.id;
        // Log immediately to show we got the message
        logToTab(tabId, "📩 Background received request", request.data);
        handleGeminiAnalysis(request.data, sendResponse, tabId);
        return true; 
    }
    if (request.action === "fetchPostDate") {
        fetchPostDate(request.url, sendResponse);
        return true;
    }
    if (request.action === "openOptionsPage") {
        chrome.runtime.openOptionsPage();
    }
});

async function scanWebsiteForKeywords(url, tabId) {
    updateProgress(tabId, "Visiting Website...", 60); 
    logToTab(tabId, `🔎 Scanning Website: ${url}`);
    
    if (!url || url === "No Link" || !url.startsWith('http')) return "No scan performed.";
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); 
        const response = await fetch(url, { method: 'GET', signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
        clearTimeout(timeoutId);

        if (!response.ok) return `Website Error ${response.status}`;

        const text = await response.text();
        const lowerText = text.toLowerCase();
        
        const clues = ['order online', 'order now', 'add to cart', 'doordash', 'ubereats', 'locations', 'slice', 'toast', 'grubhub', 'chownow', 'find us', 'store locator'];
        const found = clues.filter(clue => lowerText.includes(clue));

        if (found.length > 0) {
            logToTab(tabId, `🎯 Keywords Found: ${found.join(", ")}`);
            return `Found Keywords: ${found.join(", ")}`;
        }
        return "No keywords found.";
    } catch (error) { return "Website scan failed."; }
}

async function getDefaultApiKey(tabId) {
    try {
        const url = chrome.runtime.getURL('config.js');
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const text = await response.text();
        const match = /GEMINI_API_KEY\s*:\s*["'](.*?)["']/s.exec(text);

        if (match && match[1] && match[1] !== "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") {
            logToTab(tabId, "🔑 Using default API Key from config.js.");
            return match[1];
        }
        return null;

    } catch (e) {
        console.error("InstaLead: Error fetching or parsing config.js", e);
        return null;
    }
}

async function getApiKey(tabId) {
    logToTab(tabId, "Checking for API key...");

    // 1. Prioritize user-saved key from settings
    const userKey = await new Promise((resolve) => {
        chrome.storage.sync.get(['apiKey'], (items) => {
            if (items.apiKey && items.apiKey.length > 5) {
                logToTab(tabId, "🔑 Found user-provided API Key in settings.");
                resolve(items.apiKey);
            } else {
                resolve(null);
            }
        });
    });

    if (userKey) {
        return userKey;
    }

    // 2. If no user key, fall back to default key from config.js
    logToTab(tabId, "No user key found. Checking for default key in config.js...");
    return await getDefaultApiKey(tabId);
}

async function handleGeminiAnalysis(data, sendResponse, tabId) {
    const apiKey = await getApiKey(tabId);

    if (!apiKey) {
        logToTab(tabId, "❌ API Key Missing", "Please set your API key in the extension options or add a config.js file.");
        sendResponse({ error: "API Key Missing. Please set it in the extension options or create a config.js file." });
        return;
    }

    const safeName = data.name || "Unknown Business";
    const safeBio = (data.bioText || "").substring(0, 1000).replace(/(\r\n|\n|\r)/gm, " ");
    const safeLink = data.bioLink || "No Link";

    // Scan Website
    const websiteScanResult = await scanWebsiteForKeywords(safeLink, tabId);

    updateProgress(tabId, "Consulting AI...", 80);

    const prompt = `Role: Lead Qualification Expert.
        INPUT:
        - Name: "${safeName}"
        - Bio: "${safeBio}"
        - Link: "${safeLink}"
        - Web Scan: "${websiteScanResult}"
    
        INSTRUCTIONS:
        1. LOCATION COUNTING:
           - Look at the BIO text carefully. Does it list specific addresses or cities?
           - Does it say "Locations in Miami & Boston"?
           - If the Web Scan found "Store Locator", assume >1 location.
           - Use internal knowledge for famous brands.
    
        2. DELIVERY CHECK:
           - If URL is toast/slice/linktree OR Keywords found OR Bio says "Order" -> YES.
    
        OUTPUT JSON ONLY:
        { 
          "is_chain": boolean, 
          "location_count": number, 
          "has_delivery": boolean, 
          "delivery_platforms": "string",
          "reasoning": "string"
        }`;

    logToTab(tabId, `🚀 Sending Prompt to ${MODEL_NAME}`, { prompt });

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const result = await response.json();

        updateProgress(tabId, "Finalizing...", 95);

        if (!response.ok) {
            const err = JSON.stringify(result, null, 2); // Pretty print error
            logToTab(tabId, "❌ API ERROR", err);
            sendResponse({ error: `API Error ${response.status}: See Console Logs` });
            return;
        }

        if (!result.candidates || result.candidates.length === 0) {
            sendResponse({ error: "AI returned no content." });
            return;
        }

        const text = result.candidates[0].content.parts[0].text;
        const jsonText = text.replace(/```json|```/g, '').trim();

        logToTab(tabId, "✅ AI Response", JSON.parse(jsonText)); // Log success

        sendResponse({ success: true, data: JSON.parse(jsonText) });

    } catch (e) {
        logToTab(tabId, "❌ Critical Code Error", e.message);
        sendResponse({ error: "Ext Error: " + e.message });
    }
}

async function fetchPostDate(url, sendResponse) {
    try {
        const res = await fetch(url, { credentials: 'include' });
        const html = await res.text();
        let dateMatch = html.match(/"datePublished":"(.*?)"/) || html.match(/datetime="(.*?)"/);
        sendResponse({ date: dateMatch ? dateMatch[1] : null });
    } catch (e) { sendResponse({ date: null }); }
}