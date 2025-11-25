let overlay = null;
let isMinimized = true;

// 1. Create the UI
function createOverlay() {
    if (document.getElementById('insta-outreach-overlay')) return;

    overlay = document.createElement('div');
    overlay.id = 'insta-outreach-overlay';
    overlay.innerHTML = `
        <div id="io-minimized-view" style="cursor:pointer; width: 50px; height: 50px; background: #0095f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
            <span style="font-size: 28px;">⚡</span>
        </div>

        <div id="io-expanded-view" style="display:none;">
            <div style="background:#f7f7f7; padding:10px 15px; border-bottom:1px solid #dbdbdb; display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:14px;">InstaLead ⚡</strong>
                <div>
                    <button id="io-settings" style="border:none; background:none; cursor:pointer; font-size:16px; color:#888; margin-right: 10px;">⚙️</button>
                    <button id="io-close" style="border:none; background:none; cursor:pointer; font-size:16px; color:#888;">&times;</button>
                </div>
            </div>

            <div style="padding:15px;">
                <div id="io-start-view" style="text-align:center;">
                    <p style="color:#666; margin-bottom:15px; font-size:12px;">
                        1. Open Profile<br>
                        2. Scroll down until posts appear<br>
                        3. Click Start
                    </p>
                    <button id="btn-start" style="background:#0095f6; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold; width:100%; font-size:14px;">
                        START 🚀
                    </button>
                </div>

                <div id="io-progress-view" style="display:none;">
                    <div style="font-weight:bold; margin-bottom:5px;" id="io-status-text">Initializing...</div>
                    <div style="background:#eee; height:8px; border-radius:4px; overflow:hidden;">
                        <div id="io-progress-bar" style="background:#0095f6; height:100%; width:0%; transition: width 0.3s ease;"></div>
                    </div>
                    <div id="io-logs" style="margin-top:10px; font-family:monospace; font-size:11px; color:#888; height:40px; overflow:hidden; border-top:1px solid #eee; padding-top:5px;">
                        Waiting for logs...
                    </div>
                </div>

                <div id="io-result-view" style="display:none;">
                    <div id="io-result-content" style="margin-bottom:10px;"></div>
                    
                    <div id="io-thoughts" style="background:#f0f2f5; padding:10px; border-radius:6px; margin-bottom:15px; font-size:11px; color:#555; border-left: 4px solid #6c5ce7; line-height:1.4;">
                        <strong>🧠 AI Thoughts:</strong><br><span id="io-thoughts-text">...</span>
                    </div>

                    <div style="display:flex; gap:8px;">
                         <button id="btn-log-sent" style="flex:1; background:#00c676; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;">✅ Sent</button>
                         <button id="btn-skip" style="flex:1; background:#efefef; color:#333; border:none; padding:10px; border-radius:6px; cursor:pointer;">⏭️ Skip</button>
                    </div>
                    <div style="margin-top:10px; text-align:center;">
                         <button id="btn-export" style="background:none; border:none; color:#0095f6; cursor:pointer; font-size:11px; text-decoration:underline;">Download CSV Log</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('io-minimized-view').onclick = expandOverlay;
    document.getElementById('io-close').onclick = minimizeOverlay;
    document.getElementById('io-settings').onclick = () => chrome.runtime.sendMessage({ action: "openOptionsPage" });
    document.getElementById('btn-start').onclick = startAnalysis;
    document.getElementById('btn-export').onclick = exportCSV;
    document.getElementById('btn-log-sent').onclick = () => logInteraction("SENT", "Success");
    document.getElementById('btn-skip').onclick = () => {
        const r = prompt("Reason?"); if(r) logInteraction("SKIPPED", r);
    };
    
    minimizeOverlay();
}

function minimizeOverlay() {
    isMinimized = true;
    overlay.style.cssText = `
        position: fixed; top: 100px; right: 20px; z-index: 99999;
    `;
    document.getElementById('io-minimized-view').style.display = 'flex';
    document.getElementById('io-expanded-view').style.display = 'none';
}

function expandOverlay() {
    isMinimized = false;
    overlay.style.cssText = `
        position: fixed; top: 100px; right: 20px; width: 350px;
        background: white; border: 1px solid #dbdbdb; border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        padding: 0; font-size: 13px; color: #262626; overflow: hidden;
    `;
    document.getElementById('io-minimized-view').style.display = 'none';
    document.getElementById('io-expanded-view').style.display = 'block';
}

function updateStatus(text, percent) {
    const pView = document.getElementById('io-progress-view');
    const sView = document.getElementById('io-start-view');
    
    if (pView.style.display === 'none') {
        pView.style.display = 'block';
        sView.style.display = 'none';
    }

    document.getElementById('io-status-text').innerText = text;
    document.getElementById('io-progress-bar').style.width = percent + "%";
    document.getElementById('io-logs').innerText = `> ${text}`;
}

// 3. MAIN LOGIC (UPDATED SELECTORS)
async function startAnalysis() {
    // A. Validation: BROADER CHECK
    // matches href="/p/..." OR href="https://instagram.com/p/..."
    const posts = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
    
    if (posts.length === 0) {
        // SOFT WARNING: Allow user to override
        const forceRun = confirm("⚠️ No posts detected yet.\n\nClick OK to run analysis anyway (Date will be 'Unknown').\nClick Cancel to scroll more.");
        if (!forceRun) return;
    }

    updateStatus("Scraping Profile Data...", 10);
    document.getElementById('btn-start').disabled = true;

    const name = getProfileName();
    const bioText = document.querySelector('meta[property="og:description"]')?.content || "";
    const bioLink = getBioLink();
    
    updateStatus("Fetching Last Post Date...", 30);
    const lastPostDate = await getLatestPostDate();

    updateStatus("Contacting Background Agent...", 50);

    chrome.runtime.sendMessage({
        action: "analyzeGemini",
        data: { name, bioLink, bioText }
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn("InstaLead: " + chrome.runtime.lastError.message);
            alert("An extension error occurred. Please reload the page.");
            document.getElementById('io-start-view').style.display = 'block';
            document.getElementById('io-progress-view').style.display = 'none';
            document.getElementById('btn-start').disabled = false;
            return;
        }
        if (response.error) {
            alert("Error: " + response.error);
            // Instead of reloading, reset the UI so the user can try again
            document.getElementById('io-start-view').style.display = 'block';
            document.getElementById('io-progress-view').style.display = 'none';
            document.getElementById('btn-start').disabled = false; // Re-enable the button
            return;
        }
        renderResults(response.data, name, bioLink, lastPostDate);
    });
}

function renderResults(data, name, bioLink, lastPostDate) {
    document.getElementById('io-progress-view').style.display = 'none';
    document.getElementById('io-result-view').style.display = 'block';

    let html = `<div style="font-size:16px; font-weight:bold; margin-bottom:5px;">${name}</div>`;
    html += `<div style="font-size:12px; color:#666; margin-bottom:10px;">📅 Last Post: <b>${lastPostDate}</b></div>`;

    if (data.is_chain) {
        html += `<div style="background:#ffebee; color:#c62828; padding:8px; border-radius:4px; font-weight:bold; margin-bottom:5px;">🚩 CHAIN (${data.location_count} locs)</div>`;
    } else {
        html += `<div style="background:#e8f5e9; color:#2e7d32; padding:8px; border-radius:4px; font-weight:bold; margin-bottom:5px;">✅ LOCAL (${data.location_count || 1} loc)</div>`;
    }

    if (bioLink !== "No Link") {
        const shortLink = bioLink.replace('https://', '').substring(0, 30) + "...";
        html += `<div style="font-size:11px; margin-bottom:5px; color:#0095f6;">🔗 <a href="${bioLink}" target="_blank" style="color:inherit;">${shortLink}</a></div>`;
    }

    html += `<div style="font-size:13px; font-weight:500;">${data.has_delivery ? "🛵 Delivery: YES" : "❌ Delivery: NO"}</div>`;

    document.getElementById('io-result-content').innerHTML = html;
    document.getElementById('io-thoughts-text').innerText = data.reasoning || "No reasoning provided.";
    
    overlay.dataset.analysis = JSON.stringify({ ...data, lastPostDate, name });
}

function getProfileName() {
    const metaTitle = document.querySelector('meta[property="og:title"]')?.content;
    if (metaTitle) {
        if (metaTitle.includes('(')) return metaTitle.split('(')[0].trim();
        if (metaTitle.includes('•')) return metaTitle.split('•')[0].trim();
    }
    const h2 = document.querySelector('h2');
    return h2 ? h2.innerText : "Unknown";
}

function getBioLink() {
    const main = document.querySelector('main');
    if (!main) return "No Link";
    const anchors = Array.from(main.querySelectorAll('a'));
    for (let a of anchors) {
        let href = a.href;
        if (href.includes('l.instagram.com') && href.includes('u=')) {
            try { return decodeURIComponent(new URL(href).searchParams.get('u')); } catch(e){}
        }
        if (!href.includes('instagram.com') && !href.startsWith('/') && href.startsWith('http')) return href;
    }
    return "No Link";
}

// --- UPDATED POST FETCHER (Does not crash if empty) ---
async function getLatestPostDate() {
    // Broader search selector
    let anchors = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
    
    if (anchors.length === 0) {
        // Try wiggle one last time
        window.scrollBy(0, 100); await new Promise(r => setTimeout(r, 300));
        window.scrollBy(0, -100);
        anchors = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
    }

    // If still empty, return Unknown (Do NOT block the app)
    if (anchors.length === 0) return "Unknown (Hidden)";
    
    let targetUrl = anchors[0].href;
    for (let anchor of anchors) {
        if (!anchor.innerHTML.includes('Pinned') && !anchor.innerHTML.includes('M16 11.75V6.5')) {
            targetUrl = anchor.href;
            break;
        }
    }
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "fetchPostDate", url: targetUrl }, (res) => {
            resolve(res?.date ? new Date(res.date).toLocaleDateString() : "Unknown");
        });
    });
}

// --- LOGGING PROXY ---
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "updateStatus") updateStatus(request.text, request.percent);
    if (request.action === "logProxy") {
        console.groupCollapsed(`%c[Background] ${request.message}`, "color: #a55eea; font-weight: bold;");
        if (request.data) console.log(request.data);
        console.groupEnd();
    }
});

// LOGGING FUNCTIONS
function logInteraction(status, reason) {
    let analysisData = {};
    try { analysisData = JSON.parse(overlay.dataset.analysis || "{}"); } catch(e){}
    const logEntry = {
        date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString(),
        profile: analysisData.name || getProfileName(), status, reason,
        locations: analysisData.location_count || "?", delivery: analysisData.has_delivery ? "Yes" : "No",
        lastPost: analysisData.lastPostDate || "?", ai_reason: analysisData.reasoning || ""
    };
    chrome.storage.local.get(['outreachLog'], (r) => {
        const logs = r.outreachLog || []; logs.push(logEntry);
        chrome.storage.local.set({ outreachLog: logs }, () => {
             const b = status === "SENT" ? document.getElementById('btn-log-sent') : document.getElementById('btn-skip');
             b.innerText = "Saved!"; setTimeout(()=>b.innerText = status === "SENT" ? "Sent" : "Skip", 1500);
        });
    });
}
function exportCSV() {
    chrome.storage.local.get(['outreachLog'], (result) => {
        const logs = result.outreachLog || []; if (!logs.length) return alert("No logs found");
        const csv = "Date,Time,Profile,Status,Reason,Locations,Delivery,LastPost,AI_Reason\n" + logs.map(e => Object.values(e).map(v => `"${v}"`).join(",")).join("\n");
        const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURI(csv); a.download = "outreach_log.csv"; document.body.appendChild(a); a.click();
    });
}

// INIT
let lastUrl = location.href;
setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (location.href.includes('instagram.com/')) {
            createOverlay();
        }
    }
}, 1000);
if (location.href.includes('instagram.com/')) { createOverlay(); }