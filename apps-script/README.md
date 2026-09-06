# ProHome Commercial Dashboard V1 - Google Apps Script Backend

This directory contains the production Google Apps Script (GAS) API that connects the ProHome Commercial Dashboard to your private Google Spreadsheet.

## 1. Spreadsheet Setup
1. Go to [Google Sheets](https://sheets.new) and create a new private spreadsheet.
2. Name the spreadsheet: **`ProHome Commercial Dashboard DB`**
3. Copy its Spreadsheet ID from the URL (the string between `/d/` and `/edit`).

## 2. Deploy the Apps Script Web App
1. Inside your Google Sheet, click **Extensions** > **Apps Script**.
2. Erase any default code in `Code.gs` and paste the contents of `apps-script/Code.gs`.
3. In the Apps Script editor, open **Project Settings** (gear icon on the left sidebar) > **Script Properties** > **Add script property**:
   - Property: `GOOGLE_APPS_SCRIPT_SECRET`
   - Value: `prohome_secret_key_2026` (or any custom strong secret)
   - Property: `SPREADSHEET_ID` (optional, can also auto-detect by name)
   - Value: `<Your Google Sheet ID>`
4. Click **Save script properties**.

## 3. Deploy as a Web App
1. In the top right of the Apps Script editor, click **Deploy** > **New deployment**.
2. Click the gear icon next to "Select type" and select **Web app**.
3. Configure the deployment:
   - **Description**: `ProHome Commercial API V1`
   - **Execute as**: `Me (your Google email)`
   - **Who has access**: `Anyone` *(Crucial: Access is authenticated via the `GOOGLE_APPS_SCRIPT_SECRET` token sent securely by the server)*
4. Click **Deploy**.
5. Copy the generated **Web app URL** (starts with `https://script.google.com/macros/s/.../exec`).

## 4. Server-Side Configuration
In your environment (or AI Studio Settings panel):
- `GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/.../exec"`
- `GOOGLE_APPS_SCRIPT_SECRET="prohome_secret_key_2026"`

The Express server will automatically connect to your Google Spreadsheet, verify the connection, and persist all data.

If `GOOGLE_APPS_SCRIPT_URL` is not yet configured, the server automatically operates in local resilient persistence mode (`data/store.json`), allowing instant full dashboard testing and editing. You can push all data to Google Sheets with one click from the Settings page once deployed!
