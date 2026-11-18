# MediScan — medicine label scanner

MediScan is a mobile-first hackathon prototype inspired by the supplied screenshots. It includes a three-step onboarding experience, a medicine scanning screen, official-label lookup, safety sections, and a nearby-pharmacy search link.

## Features

- Welcome screen and responsive phone-scanner illustration.
- Three onboarding steps: name/age, optional phone, and home city/area.
- Phone number is optional, stays only in page memory, and is never sent or used for calls/texts. Avoid entering real personal details on a public demo.
- Browser geolocation is optional; the user must grant permission. A location name is used to prepare a Google Maps pharmacy search.
- Camera/photo upload and in-browser OCR with Tesseract.js. OCR proposes text only; the user must verify the medicine name.
- Manual medicine-name lookup against the U.S. FDA openFDA drug-label API.
- Product label sections for directions, pediatric use, warnings, contraindications, side effects, interactions, and storage when available.
- Explicit child-safety warnings and no personalized dose calculation.

## Run locally

```bash
npm install
npm run dev
```

## Build and deploy

```bash
npm run build
```

For Netlify, use build command `npm run build` and publish directory `dist`.

## Safety and data limitations

This educational prototype is not a doctor, pharmacist, medical device, or clinical decision-support system. It cannot diagnose, authenticate a medicine from a photo, determine that a label match is the same product, or calculate a safe personal dose. Do not use it to decide what medicine or dose to take, especially for children. Follow the specific package leaflet and prescription; ask a parent/guardian and licensed pharmacist or clinician.

FDA label data is U.S.-specific, may be incomplete or lengthy, and may not cover products sold in other countries. OCR can be wrong. The app sends the typed medicine name to openFDA when a lookup is requested. If the user chooses current location, approximate coordinates are sent to OpenStreetMap Nominatim for reverse geocoding; pharmacy searches open Google Maps. The app does not persist the profile. For an emergency or possible overdose, contact local emergency services or poison control.
