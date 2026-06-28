import { t, TRANSLATIONS } from './i18n.js';
import { parseExcel } from './excel_parser.js';
import { assignAngles, buildPrompt, ANGLE_POOL } from './prompt_builder.js';
import { uploadFacePhotos, generatePhoto } from './fal_client.js';

// ── State ───────────────────────────────────────────────────────────
export const state = {
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
export function goToStep(n) {
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
    btn.addEventListener('click', () => {
      state.selectedMode = btn.dataset.val;
      renderStep2();
    });
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

function renderStep3() {}

function renderStep3Prompts() {}

// ── Boot ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
  initLang();
  initStep1();
});
