import { useMemo, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';

const AREAS = {
  'New Delhi': ['Connaught Place', 'Dwarka', 'Karol Bagh', 'Rohini', 'South Delhi'],
  Mumbai: ['Andheri', 'Bandra', 'Dadar', 'Powai', 'Thane'],
  Karachi: ['Clifton', 'DHA', 'Gulshan-e-Iqbal', 'North Nazimabad', 'Saddar'],
  Lahore: ['DHA', 'Gulberg', 'Johar Town', 'Model Town', 'Shahdara'],
  Dhaka: ['Dhanmondi', 'Gulshan', 'Mirpur', 'Mohammadpur', 'Uttara'],
  Bengaluru: ['Whitefield', 'Indiranagar', 'Jayanagar', 'Koramangala', 'Yelahanka'],
  Other: ['Central area', 'North area', 'South area', 'East area', 'West area']
};

const FDA_FIELDS = [
  ['indications_and_usage', 'What it is used for'],
  ['dosage_and_administration', 'Dosage on the label'],
  ['pediatric_use', 'Children and adolescents'],
  ['warnings', 'Warnings'],
  ['warnings_and_cautions', 'Warnings and cautions'],
  ['contraindications', 'When not to use'],
  ['adverse_reactions', 'Possible side effects'],
  ['drug_interactions', 'Drug interactions']
];

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const trimText = (value, limit = 900) => {
  const text = cleanText(value);
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
};

async function lookupLabel(name) {
  const escaped = name.replaceAll('"', '\\"');
  const search = `openfda.brand_name:"${escaped}" OR openfda.generic_name:"${escaped}"`;
  const response = await fetch(`https://api.fda.gov/drug/label.json?search=${encodeURIComponent(search)}&limit=1`);
  if (!response.ok) throw new Error(response.status === 404 ? 'No matching FDA label was found.' : 'The FDA label service is temporarily unavailable.');
  const data = await response.json();
  return data.results?.[0] || null;
}

function PhoneIllustration() {
  return (
    <div className="phone-art" aria-label="Illustration of a phone scanning a medicine bottle" role="img">
      <div className="art-spark spark-one">✦</div><div className="art-spark spark-two">✦</div>
      <div className="phone-frame">
        <div className="phone-camera" />
        <div className="phone-screen">
          <div className="screen-top"><span>MEDLENS</span><span className="signal">● ● ●</span></div>
          <div className="scan-view">
            <div className="scan-corner corner-tl" /><div className="scan-corner corner-tr" />
            <div className="scan-corner corner-bl" /><div className="scan-corner corner-br" />
            <div className="bottle"><div className="bottle-cap" /><div className="bottle-label"><span>MEDICINE</span><b>LABEL</b><i /></div></div>
            <div className="scan-beam" />
          </div>
          <div className="screen-caption"><span className="green-dot" /> Ready to scan</div>
          <div className="screen-button"><span>Scan medicine</span><b>⌕</b></div>
        </div>
      </div>
      <div className="art-note"><span>✦</span> Label scan preview</div>
    </div>
  );
}

function App() {
  const fileRef = useRef(null);
  const [profile, setProfile] = useState({ name: '', age: '', city: '', area: '' });
  const [started, setStarted] = useState(false);
  const [medicine, setMedicine] = useState('');
  const [preview, setPreview] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [label, setLabel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Take a clear photo of the medicine package, or enter its name.');
  const [error, setError] = useState('');

  const ageGroup = useMemo(() => {
    const age = Number(profile.age);
    if (!Number.isFinite(age) || !profile.age) return '';
    if (age < 13) return 'child';
    if (age < 18) return 'teen';
    return 'adult';
  }, [profile.age]);

  const pharmacyUrl = useMemo(() => {
    const location = [profile.area, profile.city].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`pharmacy near ${location}`)}`;
  }, [profile.area, profile.city]);

  const begin = (event) => {
    event.preventDefault();
    if (!profile.name.trim() || !profile.age || !profile.city || !profile.area) return;
    setStarted(true);
  };

  const scanFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image of the medicine package.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setLabel(null);
    setError('');
    setBusy(true);
    setMessage('Reading the package label…');
    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: (event) => {
          if (event.status === 'recognizing text') setMessage(`Reading label… ${Math.round(event.progress * 100)}%`);
        }
      });
      const text = result.data.text || '';
      setOcrText(text);
      const lines = text.split(/[\n\r]+/).map(cleanText).filter((line) => line.length > 2);
      const candidate = lines.find((line) => /[a-z]/i.test(line) && !/\b(mg|ml|tablet|capsule|expiry|batch|manufactured|warning|dosage)\b/i.test(line)) || lines[0] || '';
      if (candidate) setMedicine(candidate.slice(0, 80));
      setBusy(false);
      setMessage(candidate ? 'Label scanned. Check the medicine name below, then look up its official label.' : 'No clear name detected. Enter the medicine name manually.');
    } catch {
      setBusy(false);
      setError('Could not read that image. Try a brighter, sharper photo or enter the medicine name.');
      setMessage('Scan did not complete.');
    }
  };

  const searchMedicine = async (event) => {
    event.preventDefault();
    if (!medicine.trim()) {
      setError('Enter the medicine name shown on the package first.');
      return;
    }
    setBusy(true);
    setError('');
    setLabel(null);
    setMessage('Looking up the official FDA package label…');
    try {
      const result = await lookupLabel(medicine.trim());
      if (!result) throw new Error('No matching FDA label was found.');
      setLabel(result);
      setMessage('FDA label found. Review the package details with a pharmacist or clinician.');
    } catch (lookupError) {
      setError(`${lookupError.message} Check the spelling or use the package's generic name.`);
      setMessage('Information could not be verified.');
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    setStarted(false);
    setMedicine(''); setLabel(null); setOcrText(''); setError(''); setMessage('Take a clear photo of the medicine package, or enter its name.');
  };

  if (!started) {
    return (
      <div className="page-shell">
        <header className="site-header"><a className="brand" href="#home" aria-label="MedLens home"><span className="brand-icon">✳</span> MedLens</a><span className="header-note">A medicine label helper</span></header>
        <main className="welcome-layout" id="home">
          <section className="welcome-copy">
            <div className="eyebrow"><span /> SAFER MEDICINE INFORMATION</div>
            <h1>Know what’s<br />in your <em>medicine.</em></h1>
            <p className="intro">Scan a package to find its official label information, important warnings, and a pharmacy near you.</p>
            <div className="welcome-points"><span><b>01</b> Tell us a little about you</span><span><b>02</b> Scan the medicine package</span><span><b>03</b> Review the label information</span></div>
            <form className="profile-card" onSubmit={begin}>
              <div className="form-heading"><div><span className="step-label">GET STARTED · ABOUT YOU</span><h2>Let’s get started</h2></div><div className="profile-symbol">☺</div></div>
              <label className="field-label" htmlFor="person-name">Your name</label>
              <input id="person-name" className="text-input" autoComplete="name" placeholder="Enter your name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
              <label className="field-label" htmlFor="person-age">Age</label>
              <div className="input-with-suffix"><input id="person-age" className="text-input" type="number" min="0" max="120" inputMode="numeric" placeholder="Enter age" value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })} required /><span>years</span></div>
              <div className="field-row">
                <div><label className="field-label" htmlFor="city">City</label><select id="city" className="text-input" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value, area: '' })} required><option value="">Choose city</option>{Object.keys(AREAS).map((city) => <option key={city}>{city}</option>)}</select></div>
                <div><label className="field-label" htmlFor="area">Area</label><select id="area" className="text-input" value={profile.area} onChange={(e) => setProfile({ ...profile, area: e.target.value })} disabled={!profile.city} required><option value="">Choose area</option>{(AREAS[profile.city] || []).map((area) => <option key={area}>{area}</option>)}</select></div>
              </div>
              <p className="privacy-note"><span>◈</span> Your details stay in this browser and are not sent to the FDA lookup.</p>
              <button className="button button-primary full-button" type="submit">Continue to scanner <span>→</span></button>
            </form>
          </section>
          <aside className="welcome-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><PhoneIllustration/><div className="art-bottom-note"><span className="check-mark">✓</span><div><b>Scan. Read. Understand.</b><small>Reliable label details, made easier to review.</small></div></div></aside>
        </main>
        <footer className="page-footer"><span>MedLens · Hackathon prototype</span><span>Not a substitute for medical advice</span></footer>
      </div>
    );
  }

  const sections = label ? FDA_FIELDS.flatMap(([key, title]) => {
    const value = label[key]?.filter(Boolean).join('\n\n');
    return value ? [{ key, title, value: trimText(value) }] : [];
  }) : [];
  const officialName = label?.openfda?.brand_name?.[0] || label?.openfda?.generic_name?.[0] || medicine;

  return (
    <div className="page-shell app-page">
      <header className="site-header"><a className="brand" href="#home"><span className="brand-icon">✳</span> MedLens</a><button className="text-button" onClick={startOver}>← Start over</button></header>
      <main className="scanner-layout">
        <section className="scanner-intro"><div className="eyebrow"><span /> MEDICINE LABEL SCANNER</div><h1>Hello, {profile.name.trim().split(/\s+/)[0]}.</h1><p>Photograph the medicine package. We’ll help you find and review its official label information.</p><div className="profile-chips"><span>Age {profile.age}</span><span>{profile.area}, {profile.city}</span></div></section>
        <section className="scanner-card">
          <div className="scanner-card-heading"><div><span className="step-label">YOUR SCAN</span><h2>Scan a medicine</h2></div><span className="camera-icon">⌕</span></div>
          <input ref={fileRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(e) => scanFile(e.target.files?.[0])} />
          <button type="button" className={`upload-zone ${preview ? 'has-preview' : ''}`} onClick={() => fileRef.current?.click()} aria-label="Take or upload a medicine package photo">
            {preview ? <img src={preview} alt="Preview of medicine package" /> : <span className="upload-placeholder"><span className="upload-icon">＋</span><b>Tap to take a photo</b><small>or choose an image of the package label</small></span>}
            {preview && <span className="retake-badge">↻ Retake photo</span>}
          </button>
          <div className="scan-status"><span className={busy ? 'status-dot working' : 'status-dot'} />{message}</div>
          <form className="medicine-search" onSubmit={searchMedicine}><label className="field-label" htmlFor="medicine-name">Medicine name</label><div className="search-line"><input id="medicine-name" className="text-input" value={medicine} onChange={(e) => setMedicine(e.target.value)} placeholder="Check the name on the package" /><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Look up label'}</button></div><small>OCR may misread text. Confirm the name against the package before searching.</small></form>
          {error && <div className="error-message" role="alert">{error}</div>}
          {ocrText && <details className="ocr-details"><summary>Show text detected in the photo</summary><p>{ocrText}</p></details>}
        </section>
        {label && <section className="results-card" aria-live="polite"><div className="results-heading"><div><span className="step-label">OFFICIAL LABEL LOOKUP</span><h2>{officialName}</h2><p>{label.openfda?.generic_name?.[0] && label.openfda.generic_name[0] !== officialName ? `Generic name: ${label.openfda.generic_name[0]}` : 'FDA drug label information'}</p></div><span className="source-badge">FDA label</span></div>
          <div className="safety-banner"><b>Important safety note</b><span>This is package-label information, not a dose recommendation for you. Follow the exact product label and ask a pharmacist or clinician to confirm what is appropriate.</span></div>
          {ageGroup !== 'adult' && <div className="age-banner"><b>{ageGroup === 'child' ? 'Child safety: ' : 'Under-18 safety: '}</b>Children and teens can need different instructions based on the exact product, age, and weight. Do not use an adult dose. Check the pediatric label section below and ask a pharmacist or clinician before giving medicine.</div>}
          {sections.length ? <div className="label-sections">{sections.map((section) => <article className="label-section" key={section.key}><h3>{section.title}</h3><p>{section.value}</p></article>)}</div> : <p className="empty-label">The FDA result did not include readable label sections. Check the product packaging or ask a pharmacist.</p>}
          <div className="source-note">Source: U.S. FDA drug label database (openFDA). A label match does not confirm that the package in your photo is genuine or that the medicine is right for you.</div>
        </section>}
        <section className="pharmacy-card"><div className="pharmacy-pin">⌖</div><div className="pharmacy-copy"><span className="step-label">LOCAL PHARMACIES</span><h2>Find a pharmacy nearby</h2><p>Search pharmacies around {profile.area}, {profile.city}. Results open in Google Maps; check hours and availability before visiting.</p></div><a className="button button-dark" href={pharmacyUrl} target="_blank" rel="noreferrer">Find pharmacies <span>↗</span></a></section>
        <div className="medical-disclaimer"><b>Not medical advice.</b> This prototype cannot diagnose, verify a medicine from an image, or calculate a safe personal dose. For an overdose, severe reaction, or trouble breathing, contact local emergency services or poison control now.</div>
      </main>
      <footer className="page-footer"><span>MedLens · Hackathon prototype</span><span>Your profile is only used in this page session.</span></footer>
    </div>
  );
}

export default App;
