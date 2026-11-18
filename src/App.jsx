import { useMemo, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';

const LABEL_FIELDS = [
  ['indications_and_usage', 'What it is used for'],
  ['dosage_and_administration', 'Dosage on the product label'],
  ['pediatric_use', 'Children and adolescents'],
  ['warnings', 'Warnings'],
  ['warnings_and_cautions', 'Warnings and cautions'],
  ['contraindications', 'When not to use'],
  ['adverse_reactions', 'Possible side effects'],
  ['drug_interactions', 'Drug interactions'],
  ['storage_and_handling', 'Storage']
];

const tidy = (text) => String(text || '').replace(/\s+/g, ' ').trim();
const shorten = (text, max = 1400) => {
  const value = tidy(text);
  return value.length > max ? `${value.slice(0, max).trim()}…` : value;
};

async function lookupLabel(name) {
  const safeName = name.replace(/["']/g, ' ').trim();
  const expression = `openfda.brand_name:"${safeName}" OR openfda.generic_name:"${safeName}"`;
  const response = await fetch(`https://api.fda.gov/drug/label.json?search=${encodeURIComponent(expression)}&limit=1`);
  if (response.status === 404) throw new Error('No matching U.S. FDA label was found. Check the spelling or try the generic name.');
  if (!response.ok) throw new Error('The FDA label service is unavailable right now. Please try again later.');
  const data = await response.json();
  return data.results?.[0] || null;
}

function Brand() {
  return <a className="brand" href="#home" aria-label="MediScan home"><span className="brand-mark">+</span><span>MediScan</span></a>;
}

function PhoneIllustration() {
  return (
    <div className="hero-art" role="img" aria-label="Illustration of a medicine package being scanned">
      <div className="art-halo" />
      <div className="mock-phone">
        <div className="mock-camera" />
        <div className="mock-screen">
          <div className="mock-topline"><b>MEDISCAN</b><span>● ● ●</span></div>
          <div className="mock-scan"><i className="bracket top-left"/><i className="bracket top-right"/><i className="bracket bottom-left"/><i className="bracket bottom-right"/><div className="mock-pack"><span>MEDICINE</span><b>LABEL</b><small>500 mg</small></div><div className="mock-beam"/></div>
          <div className="mock-result"><small>LABEL FOUND</small><b>Review safely</b><span>Warnings · directions</span></div>
        </div>
      </div>
      <span className="art-star star-a">✳</span><span className="art-star star-b">✦</span>
      <div className="art-caption"><span>✓</span> Scan. Read. Understand.</div>
    </div>
  );
}

function Progress({ step }) {
  const labels = ['Name', 'Phone', 'Home'];
  return <div className="progress" aria-label={`Onboarding step ${step} of 3`}><div className="progress-line"/><div className="progress-fill" style={{ width: `${((step - 1) / 2) * 100}%` }}/>{labels.map((label, index) => <div className="progress-step" key={label}><span className={index + 1 <= step ? 'step-circle active' : 'step-circle'}>{index + 1}</span><b>{label}</b></div>)}</div>;
}

export default function App() {
  const inputRef = useRef(null);
  const [view, setView] = useState('welcome');
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({ name: '', age: '', phone: '', home: '' });
  const [locationBusy, setLocationBusy] = useState(false);
  const [medicine, setMedicine] = useState('');
  const [image, setImage] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [label, setLabel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Take a clear photo of the package, or enter the medicine name.');
  const [error, setError] = useState('');

  const firstName = profile.name.trim().split(/\s+/)[0] || 'there';
  const age = Number(profile.age);
  const isMinor = profile.age !== '' && age < 18;
  const pharmacyUrl = useMemo(() => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`pharmacy near ${profile.home || ''}`)}`, [profile.home]);

  const startFresh = () => {
    setStep(1); setView('onboarding'); setProfile({ name: '', age: '', phone: '', home: '' });
    setMedicine(''); setImage(''); setOcrText(''); setLabel(null); setError('');
    setMessage('Take a clear photo of the package, or enter the medicine name.');
  };

  const nextStep = (event) => {
    event.preventDefault();
    if (step < 3) setStep(step + 1);
    else setView('home');
  };

  const useLocation = () => {
    if (!navigator.geolocation) { setError('Location is not supported by this browser. Enter your city or area instead.'); return; }
    setLocationBusy(true); setError('');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`);
        if (!response.ok) throw new Error('Could not resolve your location. You can type your city instead.');
        const result = await response.json();
        const address = result.address || {};
        setProfile((current) => ({ ...current, home: [address.suburb || address.neighbourhood || address.city_district, address.city || address.town || address.village, address.country].filter(Boolean).join(', ') || `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}` }));
      } catch (locationError) { setError(locationError.message); }
      finally { setLocationBusy(false); }
    }, () => { setLocationBusy(false); setError('Location permission was not granted. Type your city or area instead.'); }, { timeout: 10000 });
  };

  const scanImage = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file of the medicine package.'); return; }
    if (image) URL.revokeObjectURL(image);
    setImage(URL.createObjectURL(file)); setOcrText(''); setLabel(null); setError(''); setBusy(true); setMessage('Reading the package text…');
    try {
      const result = await Tesseract.recognize(file, 'eng', { logger: (event) => { if (event.status === 'recognizing text') setMessage(`Reading label… ${Math.round(event.progress * 100)}%`); } });
      const text = result.data.text || '';
      setOcrText(text);
      const candidate = text.split(/[\n\r]+/).map(tidy).filter((line) => line.length > 2).find((line) => /[a-z]/i.test(line) && !/\b(mg|ml|tablet|capsule|batch|expiry|warning|dosage)\b/i.test(line));
      if (candidate) setMedicine(candidate.slice(0, 80));
      setMessage(candidate ? 'Text detected. Confirm the medicine name before looking up its label.' : 'No clear name detected. Type the name from the package below.');
    } catch { setError('Could not read the image. Try a brighter photo or enter the name manually.'); setMessage('Scan did not complete.'); }
    finally { setBusy(false); }
  };

  const searchLabel = async (event) => {
    event.preventDefault();
    if (!medicine.trim()) { setError('Enter the medicine name shown on the package first.'); return; }
    setBusy(true); setError(''); setLabel(null); setMessage('Searching the U.S. FDA package-label database…');
    try {
      const result = await lookupLabel(medicine.trim());
      if (!result) throw new Error('No label details were returned.');
      setLabel(result); setMessage('A possible FDA label match was found. Confirm the product with its packaging or a pharmacist.');
      setView('results');
    } catch (lookupError) { setError(lookupError.message); setMessage('We could not verify a matching label.'); }
    finally { setBusy(false); }
  };

  const scanAnother = () => {
    if (image) URL.revokeObjectURL(image);
    setImage(''); setOcrText(''); setMedicine(''); setLabel(null); setError(''); setView('scan'); setMessage('Take a clear photo of the package, or enter the medicine name.');
  };

  if (view === 'welcome') return (
    <div className="site-shell" id="home"><header className="site-header"><Brand/><span className="header-note">Your pocket medicine-label helper</span></header><main className="welcome-layout"><section className="welcome-copy"><div className="eyebrow"><i/>YOUR POCKET PHARMACIST</div><h1>Scan a medicine.<br/><em>Know it.</em> Find it<br/>near home.</h1><p className="intro">Point your camera at a strip, bottle or box. MediScan helps you read the label, review important warnings, and find a nearby pharmacy.</p><div className="welcome-points"><span><b>01</b> Scan or enter a medicine name</span><span><b>02</b> Review the official label sections</span><span><b>03</b> Find a nearby pharmacy</span></div><button className="button button-primary welcome-cta" onClick={() => setView('onboarding')}>Get started <span>→</span></button><p className="small-safety">A label-reading prototype, not a doctor or dosing calculator.</p></section><PhoneIllustration/></main><footer className="page-footer"><span>MediScan · Hackathon prototype</span><span>Not a substitute for medical advice</span></footer></div>
  );

  if (view === 'onboarding') return (
    <div className="site-shell"><header className="site-header"><Brand/><span className="header-note">A few details to get started</span></header><main className="onboarding-wrap"><Progress step={step}/><form className="onboarding-card" onSubmit={nextStep}>
      {step === 1 && <><div className="step-label">STEP 1 · LET’S GET TO KNOW YOU</div><h1>What’s your name?</h1><p className="step-intro">We use it to personalize your medicine-label experience.</p><label className="field-label" htmlFor="name">Full name</label><input id="name" className="text-input large-input" autoComplete="name" placeholder="Enter your name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required/><label className="field-label" htmlFor="age">Age</label><div className="age-field"><input id="age" className="text-input large-input" type="number" min="1" max="120" inputMode="numeric" placeholder="Age in years" value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })} required/><span>years</span></div><p className="privacy-hint">Age helps us show an extra child-safety reminder. The app does not calculate a dose.</p></>}
      {step === 2 && <><div className="step-label">STEP 2 · HI {firstName.toUpperCase()} 👋</div><h1>Your phone number</h1><p className="step-intro">Phone number is optional and is not needed to use the scanner. We do not send it anywhere.</p><label className="field-label" htmlFor="phone">Mobile number <span className="optional">(optional)</span></label><input id="phone" className="text-input large-input" type="tel" autoComplete="tel" inputMode="tel" placeholder="Leave blank to skip" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })}/><p className="privacy-hint">For your privacy, don’t enter a real number on a public demo. This prototype does not call or text users.</p></>}
      {step === 3 && <><div className="step-label">STEP 3 · ALMOST THERE</div><h1>Where is home?</h1><p className="step-intro">Add a city or use your current location to search for pharmacies nearby.</p><button className="button button-primary location-button" type="button" onClick={useLocation} disabled={locationBusy}>{locationBusy ? 'Finding location…' : '⌖  Use my current location'}</button><div className="divider-label"><span/>or enter your city or area<span/></div><label className="field-label" htmlFor="home">City or area</label><input id="home" className="text-input large-input" autoComplete="address-level2" placeholder="e.g. Delhi, India" value={profile.home} onChange={(e) => setProfile({ ...profile, home: e.target.value })} required/><p className="privacy-hint">Location is used only to create a pharmacy search link. The app does not store it.</p>{error && <div className="error-message" role="alert">{error}</div>}</>}
      <div className="form-actions">{step > 1 && <button className="button button-back" type="button" onClick={() => { setStep(step - 1); setError(''); }}>← Back</button>}<button className="button button-primary action-continue" type="submit">{step === 3 ? 'Open MediScan' : 'Continue'} <span>→</span></button></div>
    </form></main><footer className="page-footer"><span>MediScan · Hackathon prototype</span><span>Your details stay in this page session.</span></footer></div>
  );

  if (view === 'home') return (
    <div className="site-shell"><header className="site-header"><Brand/><button className="profile-pill" onClick={startFresh}><span>{firstName.charAt(0).toUpperCase()}</span>{firstName}</button></header><main className="dashboard-wrap"><section className="dashboard-hero"><div className="hero-text"><div className="eyebrow"><i/>YOUR POCKET PHARMACIST</div><h1>Scan a medicine.<br/><em>Know it.</em> Find it<br/>near home.</h1><p className="intro">Point your camera at a strip, bottle or box. MediScan helps you read its label, understand important cautions, and find pharmacies near {profile.home || 'you'}.</p><button className="button button-primary welcome-cta" onClick={() => setView('scan')}>Scan a medicine <span>→</span></button><button className="text-link" onClick={startFresh}>Not you? Start fresh</button></div><PhoneIllustration/></section><section className="how-grid"><article><b>1</b><span>Tell us your name and age</span></article><article><b>2</b><span>Choose or enter your location</span></article><article><b>3</b><span>Scan, review label and find pharmacies</span></article></section><div className="safety-strip"><b>Safety first</b><span>We show label information for review—we never calculate a personal dose or replace a pharmacist or doctor.</span></div></main><footer className="page-footer"><span>MediScan · Hackathon prototype</span><span>{profile.home || 'Location not set'}</span></footer></div>
  );

  const sections = label ? LABEL_FIELDS.flatMap(([key, title]) => {
    const raw = label[key];
    const value = Array.isArray(raw) ? raw.filter(Boolean).join('\n\n') : raw;
    return value ? [{ key, title, value: shorten(value) }] : [];
  }) : [];
  const productName = label?.openfda?.brand_name?.[0] || label?.openfda?.generic_name?.[0] || medicine;

  return (
    <div className="site-shell app-shell"><header className="site-header"><Brand/><div className="header-tools"><span className="profile-pill"><span>{firstName.charAt(0).toUpperCase()}</span>{firstName}</span><button className="text-link" onClick={() => setView('home')}>Home</button></div></header><main className="scanner-layout">
      {view === 'scan' && <><section className="scanner-intro"><div className="eyebrow"><i/>MEDICINE LABEL SCANNER</div><h1>Let’s scan, {firstName}.</h1><p>Photograph the package label. Check the recognized name before looking up its information.</p></section><section className="scanner-card"><div className="card-heading"><div><span className="step-label">YOUR SCAN</span><h2>Scan a medicine</h2></div><span className="scan-icon">⌕</span></div><input ref={inputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => scanImage(event.target.files?.[0])}/><button type="button" className={`upload-zone ${image ? 'has-image' : ''}`} onClick={() => inputRef.current?.click()} aria-label="Take or upload a medicine package photo">{image ? <img src={image} alt="Preview of selected package photo"/> : <span className="upload-placeholder"><span className="upload-icon">＋</span><b>Tap to take a photo</b><small>or choose an image of the package</small></span>}{image && <span className="retake-badge">↻ Retake photo</span>}</button><p className="scan-status"><i className={busy ? 'working' : ''}/>{message}</p><form className="medicine-search" onSubmit={searchLabel}><label className="field-label" htmlFor="medicine-name">Medicine name</label><div className="search-line"><input id="medicine-name" className="text-input" value={medicine} onChange={(event) => setMedicine(event.target.value)} placeholder="Confirm or enter name from package"/><button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Look up label'}</button></div><small>OCR can misread text. Confirm the product name and strength from the package.</small></form>{error && <div className="error-message" role="alert">{error}</div>}{ocrText && <details className="ocr-details"><summary>Show text detected from photo</summary><p>{ocrText}</p></details>}</section></>}
      {view === 'results' && label && <><div className="results-top"><button className="text-link" onClick={() => setView('scan')}>← Back to scanner</button><span className="profile-pill"><span>{firstName.charAt(0).toUpperCase()}</span>{firstName}</span></div><section className="results-card"><div className="match-badges"><span>Possible label match</span><b>U.S. FDA label</b></div><h1>{productName}</h1>{label.openfda?.generic_name?.[0] && <p className="generic-name">{label.openfda.generic_name[0]}</p>}<div className="intro-callout">This is label text, not a personal treatment or dosage recommendation. Confirm the product and instructions with a pharmacist or clinician.</div>{isMinor && <div className="warning-callout"><b>Child and teen safety</b><p>Do not use an adult dose for a child or teenager. Dosing can depend on the exact product, age, weight, and health. Ask a parent or guardian and a pharmacist or clinician before use.</p></div>}{sections.length ? <div className="label-sections">{sections.map((section) => <article className={['warnings','warnings_and_cautions','contraindications'].includes(section.key) ? 'label-section warning-section' : 'label-section'} key={section.key}><h2><span>{['warnings','warnings_and_cautions','contraindications'].includes(section.key) ? '!' : '✓'}</span>{section.title}</h2><p>{section.value}</p></article>)}</div> : <p className="empty-label">This FDA record did not include readable label sections. Check the package leaflet or ask a pharmacist.</p>}<p className="source-note">Source: U.S. FDA openFDA drug-label database. A match does not authenticate the photographed product or ensure the data applies to a medicine sold in your country.</p></section><section className="pharmacy-card"><span className="pharmacy-icon">⌖</span><div><span className="step-label">NEAR YOUR HOME</span><h2>Pharmacies nearby</h2><p>{profile.home || 'Search near your location'}</p><small>Search results and contact details are provided by Google Maps. Confirm hours and availability before visiting.</small><a className="button button-dark" href={pharmacyUrl} target="_blank" rel="noreferrer">Find pharmacies ↗</a></div></section><button className="button button-primary scan-another" onClick={scanAnother}>Scan another medicine</button></>}
      <div className="medical-disclaimer"><b>General information only.</b> This prototype cannot diagnose, authenticate a medicine from a photo, or calculate a safe personal dose. Follow your prescription and the product leaflet. For an emergency or possible overdose, contact local emergency services or poison control.</div>
    </main><footer className="page-footer"><span>MediScan · Hackathon prototype</span><span>Your profile is only used in this page session.</span></footer></div>
  );
}
