document.addEventListener('DOMContentLoaded', () => {
    // Load saved settings
    chrome.storage.sync.get(['apiKey', 'maxLocations', 'inactiveDays'], (items) => {
        if (items.apiKey) document.getElementById('apiKey').value = items.apiKey;
        if (items.maxLocations) document.getElementById('maxLocations').value = items.maxLocations;
        if (items.inactiveDays) document.getElementById('inactiveDays').value = items.inactiveDays;
    });

    // Save settings
    document.getElementById('save').addEventListener('click', () => {
        const apiKey = document.getElementById('apiKey').value;
        const maxLocations = document.getElementById('maxLocations').value;
        const inactiveDays = document.getElementById('inactiveDays').value;

        chrome.storage.sync.set({
            apiKey: apiKey,
            maxLocations: maxLocations,
            inactiveDays: inactiveDays
        }, () => {
            const status = document.getElementById('status');
            status.style.display = 'block';
            setTimeout(() => { status.style.display = 'none'; }, 2000);
        });
    });
});