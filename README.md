# InstaLead Outreach Assistant

InstaLead is a Chrome extension that helps you qualify leads from Instagram. It scrapes profile information, analyzes it with the Gemini AI, and provides you with a summary of the lead's potential.

## Features

*   **Lead Qualification:** Automatically analyzes Instagram profiles to determine if they are a good fit for your business.
*   **AI-Powered Insights:** Uses the Gemini AI to provide you with a detailed analysis of each lead.
*   **Web Scraping:** Scrapes websites for keywords to determine if they offer online ordering or delivery.
*   **Interaction Logging:** Logs all of your interactions with leads so you can track your progress.
*   **CSV Export:** Exports your interaction log to a CSV file for easy analysis.

## How to Use

1.  Install the extension from the Chrome Web Store (link to be added).
2.  Go to an Instagram profile that you want to analyze.
3.  Click on the InstaLead icon in your browser toolbar.
4.  The extension will scrape the profile and send it to the Gemini AI for analysis.
5.  The results of the analysis will be displayed in the extension's popup.

## Configuration

1.  Open the extension's options page by clicking on the settings icon in the InstaLead popup.
2.  Enter your Gemini API key in the "Gemini API Key" field.
3.  Click "Save Settings".

Alternatively, you can create a `config.js` file in the root of the project with the following content:

```javascript
var CONFIG = {
    GEMINI_API_KEY: "YOUR_API_KEY"
}
```

**Note:** The API key from the options page will override the one in `config.js`.
