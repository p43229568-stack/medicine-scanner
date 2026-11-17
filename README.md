# MedLens — Medicine Scanner

A safety-first hackathon prototype for scanning medicine packaging and finding official drug-label information.

## What it does

- Collects a name, age, city, and neighborhood to personalize the interface and pharmacy search.
- Uses the device camera or an image upload to read package text with Tesseract.js OCR.
- Lets the user check or correct the recognized medicine name before looking it up.
- Retrieves U.S. FDA drug-label sections through the public openFDA label API.
- Shows label dosage, pediatric-use, warnings, contraindications, side-effect, and interaction sections when those sections are present in the returned label.
- Opens Google Maps pharmacy search for the selected area; pharmacy availability and hours must be checked with the listing.
- Includes a responsive white-and-yellow design with a CSS phone-scanner illustration.

## Run locally

```bash
npm install
npm run dev
```

Open the local address printed by Vite. Create a production build with `npm run build`.

## Deploy to Netlify

- Build command: `npm run build`
- Publish directory: `dist`

## Important safety and scope

This is an educational prototype, not a medical device or clinical decision-support system. OCR can misread labels, and a database match does not authenticate the photographed product. It does **not** calculate or recommend an individual's dose. The FDA API returns U.S. product-label text, which can be lengthy, product-specific, or unavailable; it does not provide complete coverage for every medicine or country. The app deliberately asks users to confirm the medicine name and have a pharmacist or clinician interpret dosing, especially for children. Never use a demo result instead of the exact package directions or professional advice. For urgent symptoms or possible overdose, contact local emergency services or poison control.

The name, age, and selected location are kept in page state and are not sent to the FDA API. The medicine name is sent to openFDA for label lookup. OCR is processed in the browser using Tesseract.js. Pharmacy search opens Google Maps in a new tab.
