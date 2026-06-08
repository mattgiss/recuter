/* recuter — front-end logic
 * URL/paste -> Supabase `generate` function -> preview -> save (MD/PDF/DOCX)
 * via download, folder picker (File System Access API), or the local helper.
 */
'use strict';

const cfg = window.RECUTER_CONFIG || {};
const FN_URL = `${(cfg.SUPABASE_URL || '').replace(/\/$/, '')}/functions/v1/generate`;
const HELPER_URL = 'http://127.0.0.1:4567';

const $ = (sel) => document.querySelector(sel);
const el = {
  url: $('#url'),
  jobText: $('#jobText'),
  pasteBox: $('#pasteBox'),
  generate: $('#generate'),
  status: $('#status'),
  results: $('#results'),
  metaTitle: $('#metaTitle'),
  metaCompany: $('#metaCompany'),
  resumeDoc: $('#resumeDoc'),
  letterDoc: $('#letterDoc'),
  tabResume: $('#tabResume'),
  tabLetter: $('#tabLetter'),
  saveFolder: $('#saveFolder'),
  download: $('#download'),
  sendHelper: $('#sendHelper'),
};

let current = null; // last generated result

// ── helpers ────────────────────────────────────────────────
function setStatus(kind, html) {
  el.status.className = `status ${kind}`;
  el.status.innerHTML = html;
}
function sanitize(s) {
  return String(s || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
}
function selectedFormats() {
  return [...document.querySelectorAll('.formats input:checked')].map((c) => c.value);
}

// Markdown -> HTML (marked loaded globally)
function mdToHtml(md) {
  return window.marked ? window.marked.parse(md) : `<pre>${md}</pre>`;
}

// Standalone, print-ready HTML used for PDF + DOCX export.
function exportHtml(innerHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font:12pt/1.5 Georgia,'Times New Roman',serif;color:#1a1a1a;margin:0;}
    h1{font-size:22pt;margin:0 0 2pt;} h2{font-size:12.5pt;text-transform:uppercase;
      letter-spacing:.5px;border-bottom:1px solid #ccc;padding-bottom:2pt;margin:14pt 0 6pt;}
    h3{font-size:11.5pt;margin:9pt 0 1pt;} p{margin:0 0 8pt;}
    ul{margin:3pt 0 8pt;padding-left:18pt;} li{margin:1pt 0;}
  </style></head><body>${innerHtml}</body></html>`;
}

function letterToHtml(text) {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// ── build output files for the chosen formats ──────────────
async function buildFiles(formats) {
  const base = current.candidateName || 'Application';
  const co = current.company || 'Company';
  const resumeName = sanitize(`${base} - Resume - ${co}`);
  const letterName = sanitize(`${base} - Cover Letter - ${co}`);
  const files = [];

  const resumeInner = mdToHtml(current.resumeMarkdown);
  const letterInner = letterToHtml(current.coverLetter);

  for (const fmt of formats) {
    if (fmt === 'md') {
      files.push({ name: `${resumeName}.md`, blob: new Blob([current.resumeMarkdown], { type: 'text/markdown' }) });
      files.push({ name: `${letterName}.txt`, blob: new Blob([current.coverLetter], { type: 'text/plain' }) });
    } else if (fmt === 'docx') {
      if (!window.htmlDocx) { setStatus('warn', 'DOCX library failed to load — skipping DOCX.'); continue; }
      files.push({ name: `${resumeName}.docx`, blob: window.htmlDocx.asBlob(exportHtml(resumeInner)) });
      files.push({ name: `${letterName}.docx`, blob: window.htmlDocx.asBlob(exportHtml(letterInner)) });
    } else if (fmt === 'pdf') {
      if (!window.html2pdf) { setStatus('warn', 'PDF library failed to load — skipping PDF.'); continue; }
      files.push({ name: `${resumeName}.pdf`, blob: await htmlToPdf(resumeInner) });
      files.push({ name: `${letterName}.pdf`, blob: await htmlToPdf(letterInner) });
    }
  }
  return files;
}

function htmlToPdf(innerHtml) {
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:7.5in;padding:0.5in;background:#fff;';
  holder.innerHTML = exportHtml(innerHtml).replace(/^[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*$/, '');
  document.body.appendChild(holder);
  return window
    .html2pdf()
    .set({ margin: 0, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter' } })
    .from(holder)
    .outputPdf('blob')
    .then((blob) => { holder.remove(); return blob; });
}

// ── saving paths ───────────────────────────────────────────
function downloadFiles(files) {
  for (const f of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f.blob);
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
}

async function saveToFolder(files) {
  if (!window.showDirectoryPicker) {
    setStatus('warn', "This browser can't pick a folder — falling back to downloads.");
    return downloadFiles(files);
  }
  const dir = await window.showDirectoryPicker({ id: 'recuter', mode: 'readwrite' });
  for (const f of files) {
    const handle = await dir.getFileHandle(f.name, { create: true });
    const w = await handle.createWritable();
    await w.write(f.blob);
    await w.close();
  }
}

async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

async function sendToHelper(files) {
  const payload = {
    files: await Promise.all(files.map(async (f) => ({ name: f.name, base64: await blobToBase64(f.blob) }))),
  };
  const res = await fetch(`${HELPER_URL}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── render result ──────────────────────────────────────────
function showTab(which) {
  const resume = which === 'resume';
  el.tabResume.classList.toggle('active', resume);
  el.tabLetter.classList.toggle('active', !resume);
  el.resumeDoc.hidden = !resume;
  el.letterDoc.hidden = resume;
}

function render(result) {
  current = result;
  el.metaTitle.textContent = result.jobTitle || 'Tailored application';
  el.metaCompany.textContent = result.company ? `· ${result.company}` : '';
  el.resumeDoc.innerHTML = mdToHtml(result.resumeMarkdown);
  el.letterDoc.textContent = result.coverLetter;
  el.results.hidden = false;
  showTab('resume');
  el.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── generate ───────────────────────────────────────────────
async function generate() {
  const url = el.url.value.trim();
  const jobText = el.jobText.value.trim();
  if (!url && !jobText) {
    setStatus('warn', 'Paste a job listing URL (or the job description) first.');
    return;
  }
  if (!cfg.SUPABASE_URL) {
    setStatus('bad', 'Missing Supabase config — set SUPABASE_URL in config.js.');
    return;
  }

  el.generate.disabled = true;
  setStatus('work', '<span class="spinner"></span>Reading the job and tailoring your resume + cover letter… (15–40s)');

  try {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ url, jobText }),
    });
    const data = await res.json();

    if (data.needsPaste) {
      el.pasteBox.open = true;
      setStatus('warn', data.message || 'Paste the job description and try again.');
      return;
    }
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

    render(data);
    setStatus('good', 'Done. Review below, pick your formats, and save.');
  } catch (err) {
    setStatus('bad', `Generation failed: ${String(err.message || err)}`);
  } finally {
    el.generate.disabled = false;
  }
}

// ── wire up ────────────────────────────────────────────────
async function withSaving(label, fn) {
  const formats = selectedFormats();
  if (!current) return;
  if (!formats.length) { setStatus('warn', 'Pick at least one format (Markdown, PDF, or DOCX).'); return; }
  setStatus('work', `<span class="spinner"></span>Preparing ${formats.join(', ').toUpperCase()} files…`);
  try {
    const files = await buildFiles(formats);
    const note = await fn(files);
    setStatus('good', note || `Saved ${files.length} file${files.length === 1 ? '' : 's'}.`);
  } catch (err) {
    if (err && err.name === 'AbortError') { setStatus('info', 'Save canceled.'); return; }
    setStatus('bad', `${label} failed: ${String(err.message || err)}`);
  }
}

el.generate.addEventListener('click', generate);
el.url.addEventListener('keydown', (e) => { if (e.key === 'Enter') generate(); });
el.tabResume.addEventListener('click', () => showTab('resume'));
el.tabLetter.addEventListener('click', () => showTab('letter'));

el.download.addEventListener('click', () =>
  withSaving('Download', (files) => { downloadFiles(files); return `Downloaded ${files.length} files to your Downloads folder.`; }),
);
el.saveFolder.addEventListener('click', () =>
  withSaving('Save to folder', async (files) => { await saveToFolder(files); return `Saved ${files.length} files to the folder you chose.`; }),
);
el.sendHelper.addEventListener('click', () =>
  withSaving('Local helper', async (files) => {
    const out = await sendToHelper(files);
    return `Local helper wrote ${files.length} files to ${out.folder || 'its configured folder'}.`;
  }),
);

// Hide the folder button where unsupported.
if (!window.showDirectoryPicker) {
  el.saveFolder.title = 'Your browser lacks the File System Access API — use Download or the local helper.';
  el.saveFolder.classList.add('unsupported');
}
