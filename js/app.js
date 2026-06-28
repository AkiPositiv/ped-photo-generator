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

// Stubs for later tasks (prevents import errors)
function renderStep2() {}
function renderStep2Items() {}
function renderStep3Prompts() {}

// ── Boot ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
  initLang();
  initStep1();
});
