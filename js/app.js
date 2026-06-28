// ── State ───────────────────────────────────────────────────────────
const state = {
  step: 1,
  lang: localStorage.getItem('lang') || 'ru',
  apiKey: localStorage.getItem('fal_api_key') || '',
  gender: null,
  excelData: null,       // { teacherName, academicYear, monthlyData }
  selectedMonth: null,   // 'S' | 'O' | ... | 'Iyun'
  selectedMode: 'plan',  // 'plan' | 'real'
  checkedItems: new Set(),
  photoFiles: [],
  angles: {},            // { [itemKey]: string }
  prompts: {},           // { [itemKey]: string }
  faceZipUrl: null,
  results: {},           // { [itemKey]: { url: string } | { error: string } }
};

const MONTH_CODES = ['S','O','N','D','Y','F','M','A','May','Iyun'];
const ALL_ITEM_KEYS = [
  'teaching','consultations','graduation_thesis','assessment','open_lessons',
  'lesson_prep','olympiad','independent_work','professional_dev','career_guidance',
  'mutual_analysis','circles','public_duties','beautification','council_meetings',
  'cultural_work','moral_activities',
];

// ── i18n ────────────────────────────────────────────────────────────
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.documentElement.lang = state.lang;
}

// ── Step navigation ─────────────────────────────────────────────────
function goToStep(n) {
  document.querySelectorAll('.step-panel').forEach((p, i) => {
    p.classList.toggle('hidden', i + 1 !== n);
  });
  document.querySelectorAll('.step-item').forEach(item => {
    const s = parseInt(item.dataset.step);
    item.classList.toggle('active', s === n);
    item.classList.toggle('done', s < n);
  });
  state.step = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showError(id, msgKey, vars) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = t(msgKey, vars);
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ── Language switcher ───────────────────────────────────────────────
function initLang() {
  const btn = document.getElementById('btn-lang');
  btn.textContent = t('lang_switch');
  btn.addEventListener('click', () => {
    state.lang = state.lang === 'ru' ? 'uz' : 'ru';
    localStorage.setItem('lang', state.lang);
    applyTranslations();
    btn.textContent = t('lang_switch');
    renderStep2Items(); // re-render if on step 2
    renderStep3Prompts(); // re-render if on step 3
  });
}

// ── Step 1 ──────────────────────────────────────────────────────────
function initStep1() {
  const apiInput = document.getElementById('inp-api-key');
  apiInput.value = state.apiKey;
  apiInput.addEventListener('input', () => {
    state.apiKey = apiInput.value.trim();
    localStorage.setItem('fal_api_key', state.apiKey);
  });

  // Excel drag & drop
  const dropZone = document.getElementById('excel-drop');
  const fileInput = document.getElementById('excel-input');
  const status = document.getElementById('excel-status');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleExcelFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => handleExcelFile(fileInput.files[0]));

  async function handleExcelFile(file) {
    if (!file) return;
    try {
      status.textContent = '⏳ Загрузка...';
      status.classList.remove('hidden');
      state.excelData = await parseExcel(file);
      status.textContent = `✅ ${t('teacher_loaded')} ${state.excelData.teacherName} (${state.excelData.academicYear})`;
    } catch (err) {
      state.excelData = null;
      status.textContent = `❌ ${err.message}`;
    }
  }

  // Gender buttons
  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gender-btn').forEach(b => {
        b.classList.remove('border-indigo-500', 'bg-indigo-50', 'text-indigo-700');
        b.classList.add('border-gray-200', 'text-gray-600');
      });
      btn.classList.add('border-indigo-500', 'bg-indigo-50', 'text-indigo-700');
      btn.classList.remove('border-gray-200', 'text-gray-600');
      state.gender = btn.dataset.val;
    });
  });

  // Next button
  document.getElementById('btn-s1-next').addEventListener('click', () => {
    if (!state.apiKey) { showError('s1-error', 'err_no_api_key'); return; }
    if (!state.excelData) { showError('s1-error', 'err_no_excel'); return; }
    if (!state.gender) { showError('s1-error', 'err_no_gender'); return; }
    renderStep2();
    goToStep(2);
  });
}

// ── Step 2 ──────────────────────────────────────────────────────────
function renderStep2() {
  // Month pills
  const pillsEl = document.getElementById('month-pills');
  pillsEl.innerHTML = '';
  MONTH_CODES.forEach(code => {
    const monthData = state.excelData?.monthlyData?.[code];
    const hasData = monthData && Object.values(monthData).some(v => v.plan > 0 || v.real > 0);
    const btn = document.createElement('button');
    btn.className = 'month-pill px-4 py-2 rounded-full text-sm font-medium border-2 transition '
                  + (hasData ? 'border-gray-200 text-gray-600 hover:border-indigo-400 cursor-pointer'
                              : 'border-gray-100 text-gray-300 cursor-not-allowed');
    btn.textContent = t(`month_${code}`);
    btn.dataset.code = code;
    btn.disabled = !hasData;
    if (hasData) btn.addEventListener('click', () => selectMonth(code));
    pillsEl.appendChild(btn);
  });

  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('border-indigo-500', btn.dataset.val === state.selectedMode);
    btn.classList.toggle('bg-indigo-50', btn.dataset.val === state.selectedMode);
    btn.classList.toggle('text-indigo-700', btn.dataset.val === state.selectedMode);
    btn.classList.toggle('border-gray-200', btn.dataset.val !== state.selectedMode);
    btn.classList.toggle('text-gray-600', btn.dataset.val !== state.selectedMode);
    btn.onclick = () => {
      state.selectedMode = btn.dataset.val;
      renderStep2();
    };
  });

  renderStep2Items();

  // Navigation
  document.getElementById('btn-s2-back').onclick = () => goToStep(1);
  document.getElementById('btn-s2-next').onclick = () => {
    if (!state.selectedMonth) { showError('s2-error', 'err_no_items'); return; }
    if (state.checkedItems.size === 0) { showError('s2-error', 'err_no_items'); return; }
    renderStep3();
    goToStep(3);
  };
}

function selectMonth(code) {
  state.selectedMonth = code;
  state.checkedItems = new Set(); // reset on month change; renderStep2Items will re-populate
  document.querySelectorAll('.month-pill').forEach(p => {
    const active = p.dataset.code === code;
    p.classList.toggle('border-indigo-500', active);
    p.classList.toggle('bg-indigo-50', active);
    p.classList.toggle('text-indigo-700', active);
    p.classList.toggle('border-gray-200', !active && !p.disabled);
    p.classList.toggle('text-gray-600', !active && !p.disabled);
  });
  renderStep2Items();
}

function renderStep2Items() {
  const listEl = document.getElementById('items-list');
  const noMsg = document.getElementById('no-items-msg');
  if (!listEl) return;

  if (!state.selectedMonth) {
    listEl.innerHTML = '';
    noMsg.classList.remove('hidden');
    return;
  }

  const monthData = state.excelData?.monthlyData?.[state.selectedMonth] || {};
  const activeItems = ALL_ITEM_KEYS.filter(key => {
    const hours = state.selectedMode === 'plan' ? monthData[key]?.plan : monthData[key]?.real;
    return (hours || 0) > 0;
  });

  if (activeItems.length === 0) {
    listEl.innerHTML = '';
    noMsg.classList.remove('hidden');
    return;
  }
  noMsg.classList.add('hidden');

  listEl.innerHTML = '';
  // On month change checkedItems is cleared by selectMonth; on mode toggle it is preserved.
  // Only initialize to all-active when empty (i.e. fresh month selection).
  if (state.checkedItems.size === 0) state.checkedItems = new Set(activeItems);

  activeItems.forEach(key => {
    const hours = state.selectedMode === 'plan' ? monthData[key]?.plan : monthData[key]?.real;
    const checked = state.checkedItems.has(key);
    const row = document.createElement('label');
    row.className = 'flex items-center gap-3 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 px-2 rounded';
    row.innerHTML = `
      <input type="checkbox" class="item-check w-4 h-4 accent-indigo-600" data-key="${key}" ${checked ? 'checked' : ''}>
      <span class="flex-1 text-sm text-gray-700">${t('item_' + key)}</span>
      <span class="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-full">${hours} ${t('hours_suffix')}</span>
    `;
    row.querySelector('input').addEventListener('change', e => {
      if (e.target.checked) state.checkedItems.add(key);
      else state.checkedItems.delete(key);
    });
    listEl.appendChild(row);
  });
}

function renderStep3() {
  // Photo upload zone
  const photoDropEl = document.getElementById('photo-drop');
  const photoInput = document.getElementById('photo-input');
  const thumbsEl = document.getElementById('photo-thumbnails');

  photoDropEl.onclick = () => photoInput.click();
  photoDropEl.ondragover = e => { e.preventDefault(); photoDropEl.classList.add('drag-over'); };
  photoDropEl.ondragleave = () => photoDropEl.classList.remove('drag-over');
  photoDropEl.ondrop = e => {
    e.preventDefault(); photoDropEl.classList.remove('drag-over');
    addPhotos(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
  };
  photoInput.onchange = () => {
    addPhotos(Array.from(photoInput.files));
    photoInput.value = '';
  };

  function addPhotos(files) {
    const remaining = 10 - state.photoFiles.length;
    state.photoFiles.push(...files.slice(0, remaining));
    renderThumbs();
  }

  function renderThumbs() {
    thumbsEl.innerHTML = '';
    state.photoFiles.forEach((file, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'relative';
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.className = 'w-full aspect-square object-cover rounded-lg border-2 border-gray-200';
      const del = document.createElement('button');
      del.className = 'absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600';
      del.textContent = '×';
      del.onclick = () => { state.photoFiles.splice(idx, 1); renderThumbs(); };
      wrapper.appendChild(img);
      wrapper.appendChild(del);
      thumbsEl.appendChild(wrapper);
    });
  }

  // Initial angles + prompts
  if (Object.keys(state.angles).length === 0) {
    const keys = [...state.checkedItems];
    state.angles = assignAngles(keys);
    keys.forEach(key => { state.prompts[key] = buildPrompt(state.gender, key, state.angles[key]); });
  }
  renderStep3Prompts();

  // Shuffle button
  document.getElementById('btn-shuffle').onclick = () => {
    const keys = [...state.checkedItems];
    state.angles = assignAngles(keys);
    keys.forEach(key => { state.prompts[key] = buildPrompt(state.gender, key, state.angles[key]); });
    renderStep3Prompts();
  };

  // Navigation
  document.getElementById('btn-s3-back').onclick = () => goToStep(2);
  document.getElementById('btn-s3-next').onclick = () => {
    if (state.photoFiles.length === 0) { showError('s3-error', 'err_no_photos'); return; }
    renderStep4();
    goToStep(4);
  };
}

function renderStep3Prompts() {
  const container = document.getElementById('prompt-cards');
  if (!container) return;
  container.innerHTML = '';
  [...state.checkedItems].forEach(key => {
    const angle = state.angles[key] || '';
    const prompt = state.prompts[key] || '';
    const card = document.createElement('div');
    card.className = 'mb-4 p-4 border border-gray-200 rounded-xl bg-gray-50';
    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold text-gray-700">${t('item_' + key)}</span>
        <div class="flex items-center gap-2">
          <span class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">📐 ${angle}</span>
          <button class="reroll-btn text-xs text-gray-400 hover:text-indigo-600 transition" data-key="${key}" title="Переназначить ракурс">↺</button>
        </div>
      </div>
      <textarea class="prompt-ta w-full text-xs text-gray-600 border border-gray-200 rounded-lg p-2 resize-none bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300" rows="3" data-key="${key}">${prompt}</textarea>
    `;
    card.querySelector('.reroll-btn').addEventListener('click', (e) => {
      const k = e.target.dataset.key;
      const newAngle = ANGLE_POOL[Math.floor(Math.random() * ANGLE_POOL.length)];
      state.angles[k] = newAngle;
      state.prompts[k] = buildPrompt(state.gender, k, newAngle);
      renderStep3Prompts();
    });
    card.querySelector('.prompt-ta').addEventListener('input', e => {
      state.prompts[e.target.dataset.key] = e.target.value;
    });
    container.appendChild(card);
  });
}

function renderStep4() {
  document.getElementById('btn-s4-back').onclick = () => goToStep(3);
  document.getElementById('btn-download-all').onclick = downloadAllZip;

  // Auto-start generation when step 4 is rendered
  startGeneration();
}

async function startGeneration() {
  const galleryEl = document.getElementById('gallery-grid');
  const statusEl = document.getElementById('s4-status');
  const uploadProgress = document.getElementById('upload-progress');
  const downloadAllBtn = document.getElementById('btn-download-all');

  const keys = [...state.checkedItems];
  state.results = {};

  // Build placeholder cards
  galleryEl.innerHTML = '';
  keys.forEach(key => {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.id = `gallery-card-${key}`;
    card.innerHTML = `
      <div class="flex items-center justify-center aspect-square bg-gray-100">
        <div class="spinner"></div>
      </div>
      <div class="gallery-card-body">
        <p class="text-xs font-medium text-gray-700 truncate">${t('item_' + key)}</p>
        <p class="text-xs text-gray-400 mt-1" id="card-status-${key}" data-i18n="generating">Генерация...</p>
      </div>
    `;
    galleryEl.appendChild(card);
  });

  try {
    // 1. Upload face photos (once)
    uploadProgress.classList.remove('hidden');
    state.faceZipUrl = await uploadFacePhotos(state.photoFiles, state.apiKey);
    uploadProgress.classList.add('hidden');

    // 2. Fire all generation requests in parallel
    statusEl.textContent = t('generating');
    const promises = keys.map(key =>
      generatePhoto(state.apiKey, state.faceZipUrl, state.prompts[key])
        .then(url => {
          state.results[key] = { url };
          updateGalleryCard(key, url);
        })
        .catch(err => {
          state.results[key] = { error: err.message };
          updateGalleryCardError(key, err.message);
        })
    );
    await Promise.all(promises);

    statusEl.textContent = t('done');
    downloadAllBtn.classList.remove('hidden');

  } catch (err) {
    uploadProgress.classList.add('hidden');
    statusEl.textContent = t('err_upload', { msg: err.message });
  }
}

function updateGalleryCard(key, url) {
  const card = document.getElementById(`gallery-card-${key}`);
  if (!card) return;
  card.innerHTML = `
    <img src="${url}" alt="${t('item_' + key)}" loading="lazy">
    <div class="gallery-card-body">
      <p class="text-xs font-medium text-gray-700 truncate">${t('item_' + key)}</p>
      <button class="mt-2 w-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 py-1 rounded-lg hover:bg-indigo-100 transition"
        onclick="downloadSingle('${key}', '${url}')" data-i18n="btn_download">⬇ Скачать</button>
    </div>
  `;
}

function updateGalleryCardError(key, msg) {
  const card = document.getElementById(`gallery-card-${key}`);
  if (!card) return;
  card.querySelector(`#card-status-${key}`)?.remove();
  card.innerHTML = `
    <div class="flex items-center justify-center aspect-square bg-red-50">
      <span class="text-2xl">❌</span>
    </div>
    <div class="gallery-card-body">
      <p class="text-xs font-medium text-gray-700 truncate">${t('item_' + key)}</p>
      <p class="text-xs text-red-500 mt-1">${msg}</p>
    </div>
  `;
}

window.downloadSingle = async function(key, url) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  saveAs(blob, `${key}.jpg`);
};

async function downloadAllZip() {
  const zip = new JSZip();
  const fetchPromises = Object.entries(state.results)
    .filter(([, r]) => r.url)
    .map(async ([key, { url }]) => {
      const resp = await fetch(url);
      const blob = await resp.blob();
      zip.file(`${key}.jpg`, blob);
    });
  await Promise.all(fetchPromises);
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, 'ped_photos.zip');
}

// ── Composer ────────────────────────────────────────────────────────
function initComposer() {
  const faceDropEl    = document.getElementById('comp-face-drop');
  const faceInputEl   = document.getElementById('comp-face-input');
  const facePreview   = document.getElementById('comp-face-preview');
  const faceImgEl     = document.getElementById('comp-face-img');
  const sampleDropEl  = document.getElementById('comp-sample-drop');
  const sampleInputEl = document.getElementById('comp-sample-input');
  const samplePreview = document.getElementById('comp-sample-preview');
  const sampleImgEl   = document.getElementById('comp-sample-img');
  const errEl         = document.getElementById('comp-error');
  const spinner       = document.getElementById('comp-spinner');
  const resultDiv     = document.getElementById('comp-result');
  const resultImgEl   = document.getElementById('comp-result-img');
  const downloadBtn   = document.getElementById('comp-download-btn');

  let compFaceFile   = null;
  let compSampleFile = null;
  let compMode       = 'desc';

  function showCompError(msg) {
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }

  // ── Face photo upload ──
  faceDropEl.onclick     = () => faceInputEl.click();
  faceDropEl.ondragover  = e => { e.preventDefault(); faceDropEl.classList.add('drag-over'); };
  faceDropEl.ondragleave = () => faceDropEl.classList.remove('drag-over');
  faceDropEl.ondrop = e => {
    e.preventDefault(); faceDropEl.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) setFaceFile(f);
  };
  faceInputEl.onchange = () => { if (faceInputEl.files[0]) setFaceFile(faceInputEl.files[0]); faceInputEl.value = ''; };

  function setFaceFile(file) {
    compFaceFile = file;
    faceImgEl.src = URL.createObjectURL(file);
    facePreview.classList.remove('hidden');
  }

  // ── Sample photo upload ──
  sampleDropEl.onclick     = () => sampleInputEl.click();
  sampleDropEl.ondragover  = e => { e.preventDefault(); sampleDropEl.classList.add('drag-over'); };
  sampleDropEl.ondragleave = () => sampleDropEl.classList.remove('drag-over');
  sampleDropEl.ondrop = e => {
    e.preventDefault(); sampleDropEl.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) setSampleFile(f);
  };
  sampleInputEl.onchange = () => { if (sampleInputEl.files[0]) setSampleFile(sampleInputEl.files[0]); sampleInputEl.value = ''; };

  function setSampleFile(file) {
    compSampleFile = file;
    sampleImgEl.src = URL.createObjectURL(file);
    samplePreview.classList.remove('hidden');
  }

  // ── Mode toggle ──
  document.getElementById('comp-mode-desc').onclick = () => setCompMode('desc');
  document.getElementById('comp-mode-photo').onclick = () => setCompMode('photo');

  function setCompMode(mode) {
    compMode = mode;
    const descBtn  = document.getElementById('comp-mode-desc');
    const photoBtn = document.getElementById('comp-mode-photo');
    const descPanel  = document.getElementById('comp-desc-panel');
    const photoPanel = document.getElementById('comp-photo-panel');
    const isDesc = mode === 'desc';
    descBtn.classList.toggle('border-indigo-500', isDesc);
    descBtn.classList.toggle('bg-indigo-50', isDesc);
    descBtn.classList.toggle('text-indigo-700', isDesc);
    descBtn.classList.toggle('border-gray-200', !isDesc);
    descBtn.classList.toggle('text-gray-500', !isDesc);
    photoBtn.classList.toggle('border-indigo-500', !isDesc);
    photoBtn.classList.toggle('bg-indigo-50', !isDesc);
    photoBtn.classList.toggle('text-indigo-700', !isDesc);
    photoBtn.classList.toggle('border-gray-200', isDesc);
    photoBtn.classList.toggle('text-gray-500', isDesc);
    descPanel.classList.toggle('hidden', !isDesc);
    photoPanel.classList.toggle('hidden', isDesc);
  }

  // ── Generate ──
  document.getElementById('comp-generate-btn').onclick = async () => {
    errEl.classList.add('hidden');

    if (!state.apiKey) { showCompError('Введите Fal.ai API ключ в блоке настроек выше'); return; }
    if (!compFaceFile) { showCompError('Загрузите фото учителя'); return; }
    const desc = document.getElementById('comp-prompt').value.trim();
    if (compMode === 'desc' && !desc) { showCompError('Введите описание сцены'); return; }
    if (compMode === 'photo' && !compSampleFile) { showCompError('Загрузите образец фотографии'); return; }

    resultDiv.classList.remove('hidden');
    spinner.classList.remove('hidden');
    resultImgEl.classList.add('hidden');
    downloadBtn.classList.add('hidden');

    try {
      let url;
      if (compMode === 'desc') {
        url = await composerGenerateWithDesc(state.apiKey, compFaceFile, desc);
      } else {
        const faceUrl   = await uploadSingleImage(compFaceFile, state.apiKey);
        const targetUrl = await uploadSingleImage(compSampleFile, state.apiKey);
        url = await composerFaceSwap(state.apiKey, faceUrl, targetUrl);
      }
      spinner.classList.add('hidden');
      resultImgEl.src = url;
      resultImgEl.classList.remove('hidden');
      downloadBtn.classList.remove('hidden');
      downloadBtn.onclick = async () => {
        const resp = await fetch(url);
        const blob = await resp.blob();
        saveAs(blob, 'teacher_in_scene.jpg');
      };
    } catch (err) {
      spinner.classList.add('hidden');
      showCompError('Ошибка: ' + err.message);
    }
  };
}

// ── Boot ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
  initLang();
  initStep1();
  initComposer();
});
