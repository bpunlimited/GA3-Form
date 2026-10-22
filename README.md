# GA3 Offline-first PWA

A responsive GA3 form for Windows laptops and Android devices. It saves draft fields in local browser storage, supports adding/removing rows, captures a signature in memory, and prints the completed form to PDF.

## Run locally for development

A PWA service worker requires a secure context (`https://`) or `localhost`. Opening `index.html` directly with `file://` will let the form run, but install/offline caching will not be enabled.

If Python is installed, open a terminal in this folder and run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser. This is suitable for testing on the laptop. To install the PWA on devices, publish the folder to a static HTTPS host (or serve it on a trusted HTTPS local network). No backend is needed.

## Install

- **Windows / Chrome or Edge:** visit the HTTPS site, then use the browser's Install app option.
- **Android / Chrome:** visit the HTTPS site, open the browser menu, and choose Install app or Add to Home screen.

Open the app once while online so the service worker can cache the files. It should then load offline.

## Save data and privacy

- Form data is stored in `localStorage` on the current browser/device.
- Different devices and different browser profiles do not share records.
- The signature is intentionally not persisted; it must be drawn again after closing or refreshing the app.
- Clearing browser site data can delete locally saved drafts. Export important completed forms as PDFs.

## PDF export

Select **Confirm & export PDF**. After signature validation, the browser's print dialog opens. Choose **Save as PDF** (or the equivalent option on your device). The page uses a print stylesheet for a landscape A4 form.

## Important limitations

- This starter version has not been independently certified for legal or regulated recordkeeping.
- PDF output depends on the browser's print engine and print settings.
- Do not clear site data unless you have backed up any drafts you need.
