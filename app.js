/* =============================================================
   救急シミュレーション管理システム  –  app.js
   保存: localStorage（この端末の中だけ）。ほかの端末へはファイルで書き出して渡す
   ============================================================= */

'use strict';

/* ── ID生成 ────────────────────────────────────────── */
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;

/* ── デフォルトデータ ──────────────────────────────── */
const DEFAULT_PHASE = () => ({
  id: uid(),
  label: '接触時',
  physiologicalEval: '緊急度：高',
  abcde: {
    a: '気道開通。発語あり。',
    b: '呼吸数18回/分。努力呼吸なし。肺音清。',
    c: '橈骨脈触知可能。皮膚冷感・湿潤。CRT 2秒。',
    d: 'JCS 1。瞳孔等大。対光反射迅速。',
    e: '体温36.5度。特記すべき外傷なし。'
  },
  history: '【SAMPLE】\nS (症状): \nA (アレルギー): \nM (持病・薬): \nP (既往歴): \nL (最終食事): \nE (状況): \n\n【GUMBA】\nG (既往歴): \nU (訴え): \nM (薬): \nB (病院): \nA (アレルギー): ',
  secondary: '全身観察所見を入力...',
  vitals: { jcs:'0', hr:'80', bp:'120/70', rr:'16', temp:'36.5', spo2:'98', ecg:'Sinus' },
  findings: '現場の状況や補足事項...'
});

const DEFAULT_SCENARIO = () => ({
  id: uid(),
  title: '新規救急シナリオ',
  info: {
    age: '60代', gender: '男性',
    goals: '・正確な生理学的評価の実施\n・病態に応じた搬送先選定',
    points: '環境要因と主訴の不一致から隠れた内科的疾患を疑う。',
    dispatch: '意識障害疑いでの出場。自室内で倒れているところを家族が発見。',
    callback: '呼びかけに反応はあるが、会話が噛み合わない様子。',
    hpi: '1時間前まで普段通り過ごしていたが、その後連絡がつかなくなった。',
    situation: '室内。暖房なし。床上に仰臥位。',
    takeHomeMessage: '現場での「観察の違和感」を大切にし、多角的な評価を継続してください。'
  },
  phases: [DEFAULT_PHASE()],
  evaluations: [
    { id: uid(), task: '適切なABCDEアプローチ', explanation: '手順通りに生理学的評価が実施されたか。' }
  ]
});

/* ── 状態 ──────────────────────────────────────────── */
let scenario     = DEFAULT_SCENARIO();
let savedList    = [];        // ライブラリ一覧 (localStorageから)
let phaseIdx     = -1;        // -1 = 事前情報
let evalResults  = {};
let editMode     = false;
let activeTab    = 'monitor';
let records      = [];        // 評価の記録 (localStorageから)

/* ── localStorage ──────────────────────────────────── */
const LS_DRAFT   = 'ems_draft';
const LS_LIBRARY = 'ems_library';
const LS_RECORDS = 'ems_records';

const clone = (o) => JSON.parse(JSON.stringify(o));

function saveDraftLocal() {
  try {
    localStorage.setItem(LS_DRAFT, JSON.stringify({ scenario, phaseIdx, evalResults }));
    localStorage.setItem(LS_LIBRARY, JSON.stringify(savedList));
    localStorage.setItem(LS_RECORDS, JSON.stringify(records));
  } catch (e) {
    console.warn('localStorage 書き込みエラー:', e);
    showToast('保存できませんでした（端末の空きが足りない可能性があります）');
  }
}

function loadDraftLocal() {
  try {
    const d = localStorage.getItem(LS_DRAFT);
    if (d) {
      const obj = JSON.parse(d);
      if (obj.scenario) scenario   = obj.scenario;
      if (obj.phaseIdx !== undefined) phaseIdx = obj.phaseIdx;
      if (obj.evalResults) evalResults = obj.evalResults;
    }
    const lib = localStorage.getItem(LS_LIBRARY);
    if (lib) savedList = JSON.parse(lib);
    const rec = localStorage.getItem(LS_RECORDS);
    if (rec) records = JSON.parse(rec);
  } catch (e) { console.warn('localStorage 読み込みエラー:', e); }
  if (phaseIdx >= scenario.phases.length) phaseIdx = -1;
}

/* ── 自動保存 (debounce 1.2s) ──────────────────────── */
let _saveTimer = null;
function scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveDraftLocal, 1200);
}

/* ── シナリオ保存（ライブラリへ）──────────────────── */
// ライブラリには写しを入れる。保存ボタンを押すまで、ライブラリの中身は変わらない
function saveScenario() {
  const idx = savedList.findIndex(s => s.id === scenario.id);
  if (idx >= 0) {
    savedList[idx] = clone(scenario);
  } else {
    savedList.unshift(clone(scenario));
  }
  saveDraftLocal();
  renderLibraryList();
  showToast('保存しました');
  setEditMode(false);
}

// 今の想定に、ライブラリへ保存していない変更があるか
function isDirty() {
  const s = savedList.find(x => x.id === scenario.id);
  if (!s) return JSON.stringify(scenario) !== JSON.stringify(_blankOf(scenario));
  return JSON.stringify(s) !== JSON.stringify(scenario);
}
// 新規作成のまま何も書いていない想定は、捨てても確認しない
function _blankOf(s) {
  const b = DEFAULT_SCENARIO();
  b.id = s.id;
  b.phases.forEach((p, i) => { if (s.phases[i]) p.id = s.phases[i].id; });
  b.evaluations.forEach((v, i) => { if (s.evaluations[i]) v.id = s.evaluations[i].id; });
  return b;
}
function confirmDiscard() {
  return !isDirty() || confirm('今の想定に、保存していない変更があります。\n保存せずに切り替えますか？');
}

/* ── 新規作成・複製 ────────────────────────────────── */
function newScenario() {
  if (!confirmDiscard()) return;
  scenario    = DEFAULT_SCENARIO();
  phaseIdx    = -1;
  evalResults = {};
  closeModal('modal-lib');
  saveDraftLocal();
  setEditMode(true);
  showToast('新しい想定を作りました。書き終えたら保存を押してください');
}

function duplicateScenario() {
  const c = clone(scenario);
  c.id    = uid();
  c.title = (scenario.title || '想定') + '（コピー）';
  c.phases.forEach(p => { p.id = uid(); });
  scenario    = c;
  phaseIdx    = -1;
  evalResults = {};
  closeModal('modal-lib');
  saveDraftLocal();
  setEditMode(true);
  showToast('複製しました。保存すると別の想定として残ります');
}

/* ── シナリオ削除 ──────────────────────────────────── */
function deleteScenario(id) {
  const s = savedList.find(x => x.id === id);
  if (!s) return;
  if (!confirm(`「${s.title}」をライブラリから消しますか？\n消した想定は元に戻せません。`)) return;
  savedList = savedList.filter(x => x.id !== id);
  saveDraftLocal();
  renderLibraryList();
  showToast('消しました');
}

/* ── シナリオ読込 ──────────────────────────────────── */
function loadScenario(id) {
  const s = savedList.find(x => x.id === id);
  if (!s) return;
  if (s.id !== scenario.id && !confirmDiscard()) return;
  scenario    = clone(s);
  phaseIdx    = -1;
  evalResults = {};
  closeModal('modal-lib');
  saveDraftLocal();
  renderAll();
}

/* ── 編集モード ────────────────────────────────────── */
function setEditMode(val) {
  editMode = val;
  document.getElementById('btn-edit').classList.toggle('active', val);
  document.getElementById('edit-label').textContent = val ? '完了' : '想定編集';
  document.getElementById('edit-btns').style.display = val ? 'flex' : 'none';
  renderAll();
  if (window.innerWidth < 1024) switchTab(activeTab);
}

/* ── フェーズ操作 ──────────────────────────────────── */
function addPhase() {
  const last = JSON.parse(JSON.stringify(scenario.phases.slice(-1)[0] || DEFAULT_PHASE()));
  last.id    = uid();
  last.label = `経過${scenario.phases.length}`;
  scenario.phases.push(last);
  phaseIdx = scenario.phases.length - 1;
  scheduleSave();
  renderAll();
}

function deletePhase(idx) {
  if (scenario.phases.length <= 1) return;
  scenario.phases.splice(idx, 1);
  phaseIdx = -1;
  scheduleSave();
  renderAll();
}

/* ── 評価操作 ──────────────────────────────────────── */
function setEval(id, val) {
  evalResults[id] = evalResults[id] === val ? undefined : val;
  scheduleSave();
  renderEval();
}

function resetEval() {
  evalResults = {};
  scheduleSave();
  renderEval();
}

function addEvalItem() {
  scenario.evaluations.push({ id: uid(), task: '新規評価項目', explanation: '根拠やポイントを記載...' });
  scheduleSave();
  renderEval();
}

function deleteEvalItem(id) {
  scenario.evaluations = scenario.evaluations.filter(e => e.id !== id);
  scheduleSave();
  renderEval();
}

/* ── タブ切替 ──────────────────────────────────────── */
function switchTab(tab) {
  activeTab = tab;
  document.getElementById('sec-monitor').classList.toggle('hidden', tab !== 'monitor');
  document.getElementById('sec-eval').classList.toggle('hidden', tab !== 'eval');
  document.getElementById('nav-mon').classList.toggle('active', tab === 'monitor');
  document.getElementById('nav-eval').classList.toggle('active', tab === 'eval');
}

/* ── モーダル ──────────────────────────────────────── */
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.style.overflow = '';
}

/* ── IO ────────────────────────────────────────────── */
function openIO() {
  document.getElementById('io-text').value = JSON.stringify(scenario, null, 2);
  document.getElementById('io-error').innerHTML = '';
  openModal('modal-io');
}

async function copyIO() {
  const txt = document.getElementById('io-text').value;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(txt);
    } else {
      const ta = document.createElement('textarea');
      ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const icon = document.getElementById('copy-icon');
    icon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
    setTimeout(() => {
      icon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
    }, 2000);
  } catch (e) { console.warn('コピー失敗:', e); }
}

function importIO() {
  const errEl = document.getElementById('io-error');
  errEl.innerHTML = '';
  let parsed;
  try {
    parsed = JSON.parse(document.getElementById('io-text').value);
  } catch (e) {
    errEl.innerHTML = '<div class="error-msg">JSONの形式が不正です。文字が欠けていないか確認してください。</div>';
    return;
  }
  if (parsed && parsed.app === FILE_APP && Array.isArray(parsed.scenarios)) { closeModal('modal-io'); mergeAll(parsed); return; }
  if (!isScenario(parsed)) {
    errEl.innerHTML = '<div class="error-msg">正しいシナリオデータではありません。</div>';
    return;
  }
  loadImported(parsed);
}

/* ── トースト ──────────────────────────────────────── */
let _toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

/* ── ヘルパー: escape ──────────────────────────────── */
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* =============================================================
   レンダリング
   ============================================================= */

function renderAll() {
  document.getElementById('header-title').textContent = scenario.title;
  renderPhaseNav();
  renderMonitor();
  renderEval();
  if (window.innerWidth < 1024) switchTab(activeTab);
}

/* ── フェーズナビ ──────────────────────────────────── */
function renderPhaseNav() {
  const nav = document.getElementById('phase-nav');
  let html = '';

  html += `<button class="phase-btn ${phaseIdx===-1?'sel-dark':''}" onclick="phaseIdx=-1;renderAll()">事前情報</button>`;

  scenario.phases.forEach((p, i) => {
    html += `<div class="phase-wrap">`;
    if (editMode) {
      html += `<div style="display:flex;flex-direction:column;gap:3px;align-items:center">`;
      // タブ切替ボタン（ラベルはinputと連動しないため別途id付与）
      html += `<button class="phase-btn ${phaseIdx===i?'sel-blue':''}" onclick="phaseIdx=${i};renderAll()" id="phase-tab-btn-${i}">${esc(p.label)}</button>`;
      // ラベル編集: oninputでデータだけ更新し再レンダーしない。blurでボタンテキストのみ同期
      html += `<input
        id="phase-label-input-${i}"
        style="width:80px;font-size:10px;padding:3px 6px;border:1px solid var(--border-2);border-radius:6px;background:var(--surface);color:var(--text);text-align:center;outline:none"
        value="${esc(p.label)}"
        oninput="scenario.phases[${i}].label=this.value;scheduleSave();const b=document.getElementById('phase-tab-btn-${i}');if(b)b.textContent=this.value;"
      >`;
      html += `</div>`;
      if (scenario.phases.length > 1) {
        html += `<button class="phase-btn-del" onclick="deletePhase(${i})" title="削除">✕</button>`;
      }
    } else {
      html += `<button class="phase-btn ${phaseIdx===i?'sel-blue':''}" onclick="phaseIdx=${i};renderAll()">${esc(p.label)}</button>`;
    }
    html += `</div>`;
  });

  if (editMode) {
    html += `<button class="phase-add-btn" onclick="addPhase()" title="フェーズを追加">＋</button>`;
  }

  nav.innerHTML = html;
}

/* ── モニターセクション ────────────────────────────── */
function renderMonitor() {
  const el = document.getElementById('monitor-area');
  el.innerHTML = phaseIdx === -1 ? renderInfo() : renderPhase(scenario.phases[phaseIdx], phaseIdx);
}

function field(label, valHtml) {
  return `<div style="margin-bottom:2px"><span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">${label}</span><div style="margin-top:4px">${valHtml}</div></div>`;
}

function renderInfo() {
  const info = scenario.info;
  const e = editMode;
  const ta = (fld, val, h=80) =>
    `<textarea class="edit-input" style="min-height:${h}px" oninput="scenario.info.${fld}=this.value;scheduleSave()">${esc(val)}</textarea>`;
  const inp = (fld, val, ph='') =>
    `<input class="edit-input" value="${esc(val)}" placeholder="${ph}" oninput="scenario.info.${fld}=this.value;scheduleSave()">`;

  let html = `<div class="animate">`;

  // タイトル（編集モード時のみ表示）
  if (e) {
    html += `<div class="card" style="border-color:var(--blue-bd)">
      <div class="card-label">シナリオタイトル</div>
      <input class="edit-input" value="${esc(scenario.title)}" oninput="scenario.title=this.value;document.getElementById('header-title').textContent=this.value;scheduleSave()">
    </div>`;
  }

  // 対象者 / 到達目標
  html += `<div class="card-grid-2">
    <div class="card">
      <div class="card-label">対象者</div>
      ${e
        ? `<div style="display:flex;gap:8px">${inp('age', info.age||'', '年齢')}${inp('gender', info.gender||'', '性別')}</div>`
        : `<div class="card-h">${esc(info.age||'-')} / ${esc(info.gender||'-')}</div>`
      }
    </div>
    <div class="goal-card">
      <div class="card-label">到達目標</div>
      ${e ? ta('goals', info.goals||'', 90) : `<div class="card-bold">${esc(info.goals||'-')}</div>`}
    </div>
  </div>`;

  // シナリオのポイント
  html += `<div class="point-card">
    <div class="card-label">シナリオのポイント</div>
    ${e ? ta('points', info.points||'', 90) : `<div class="card-bold" style="font-size:14px">${esc(info.points||'-')}</div>`}
  </div>`;

  // 現病歴 / 現場状況
  html += `<div class="card-grid-2">
    <div class="card">
      <div class="card-label">現病歴</div>
      ${e ? ta('hpi', info.hpi||'', 90) : `<div class="card-text">${esc(info.hpi||'-')}</div>`}
    </div>
    <div class="card">
      <div class="card-label">現場状況</div>
      ${e ? ta('situation', info.situation||'', 90) : `<div class="card-text">${esc(info.situation||'-')}</div>`}
    </div>
  </div>`;

  // 指令内容 / コールバック
  html += `<div class="card-grid-2">
    <div class="dispatch-card">
      <div class="card-label">指令内容</div>
      ${e ? ta('dispatch', info.dispatch||'', 80) : `<div class="card-bold">${esc(info.dispatch||'-')}</div>`}
    </div>
    <div class="callback-card">
      <div class="card-label">コールバック</div>
      ${e ? ta('callback', info.callback||'', 80) : `<div class="card-bold">${esc(info.callback||'-')}</div>`}
    </div>
  </div>`;

  html += `</div>`;
  return html;
}

function renderPhase(p, pi) {
  const e = editMode;

  const phta = (fld, val, h=70) =>
    `<textarea class="edit-input" style="min-height:${h}px" oninput="scenario.phases[${pi}].${fld}=this.value;scheduleSave()">${esc(val)}</textarea>`;

  const abcde_keys = [
    { k:'a', cls:'a', label:'A', sub:'Airway' },
    { k:'b', cls:'b', label:'B', sub:'Breathing' },
    { k:'c', cls:'c', label:'C', sub:'Circulation' },
    { k:'d', cls:'d', label:'D', sub:'Dysfunction' },
    { k:'e', cls:'e', label:'E', sub:'Exposure' }
  ];

  const vitals = [
    { k:'jcs',  l:'JCS',  u:'' },
    { k:'hr',   l:'脈拍',  u:'bpm' },
    { k:'bp',   l:'血圧',  u:'mmHg' },
    { k:'rr',   l:'呼吸数', u:'回' },
    { k:'temp', l:'体温',  u:'℃' },
    { k:'spo2', l:'SpO2', u:'%' },
    { k:'ecg',  l:'心電図', u:'' }
  ];

  let html = `<div class="animate">`;

  // 生理学的評価
  html += `<div class="emergency-card">
    <div class="e-label">生理学的評価</div>
    ${e
      ? `<select class="select-edit" onchange="scenario.phases[${pi}].physiologicalEval=this.value;scheduleSave()">
          ${['緊急度：極めて高い','緊急度：高','緊急度：中','緊急度：低','生理学的評価：安定']
            .map(v => `<option value="${v}" ${p.physiologicalEval===v?'selected':''}>${v}</option>`).join('')}
        </select>`
      : `<div class="e-value">${esc(p.physiologicalEval)}</div>`
    }
  </div>`;

  // ABCDE
  html += `<div class="abcde-panel">
    <div class="abcde-title">Phase Assessment (ABCDE)</div>`;
  abcde_keys.forEach(item => {
    html += `<div class="abcde-row">
      <span class="abcde-letter ${item.cls}">${item.label}</span>
      <div style="flex:1;min-width:0">
        ${e
          ? `<textarea class="abcde-edit" oninput="scenario.phases[${pi}].abcde.${item.k}=this.value;scheduleSave()">${esc(p.abcde?.[item.k]||'')}</textarea>`
          : `<div class="abcde-text">${esc(p.abcde?.[item.k]||'-')}</div>`
        }
      </div>
    </div>`;
  });
  html += `</div>`;

  // 主訴・病歴
  html += `<div class="hist-card">
    <div class="card-label">主訴・病歴 (SAMPLE / GUMBA)</div>
    ${e ? phta('history', p.history||'', 160) : `<div class="card-text">${esc(p.history||'-')}</div>`}
  </div>`;

  // 全身観察所見
  html += `<div class="sec-card">
    <div class="card-label">全身観察所見</div>
    ${e ? phta('secondary', p.secondary||'', 120) : `<div class="card-bold">${esc(p.secondary||'-')}</div>`}
  </div>`;

  // バイタルサイン
  html += `<div class="vitals-card">
    <div class="card-label">バイタルサイン</div>
    <div class="vitals-grid">`;
  vitals.forEach(v => {
    const val = p.vitals?.[v.k] || '';
    html += `<div class="vital-item">
      <div class="vital-label">${v.l}</div>
      ${e
        ? `<input class="edit-input" style="padding:5px 8px" value="${esc(val)}" oninput="scenario.phases[${pi}].vitals.${v.k}=this.value;scheduleSave()">`
        : `<span class="vital-val">${esc(val||'-')}</span><span class="vital-unit">${v.u}</span>`
      }
    </div>`;
  });
  html += `</div></div>`;

  // 環境・補足事項
  html += `<div class="findings-card">
    <div class="card-label">環境・補足事項</div>
    ${e ? phta('findings', p.findings||'', 70) : `<div class="card-text" style="font-style:italic">${esc(p.findings||'-')}</div>`}
  </div>`;

  html += `</div>`;
  return html;
}

/* ── 評価セクション ────────────────────────────────── */
function renderEval() {
  const el = document.getElementById('eval-area');
  const e  = editMode;

  const sorted = e
    ? [...scenario.evaluations]
    : [...scenario.evaluations].sort((a, b) =>
        (evalResults[b.id]==='ng'?1:0) - (evalResults[a.id]==='ng'?1:0));

  let html = '';

  sorted.forEach((item) => {
    const origIdx = scenario.evaluations.findIndex(x => x.id === item.id);
    const res = evalResults[item.id];

    if (e) {
      // 編集モード: ドラッグハンドル付き、oninputで再レンダーしない
      html += `<div class="eval-item eval-edit-box" data-eid="${esc(item.id)}" draggable="true"
        style="cursor:default;position:relative">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span class="drag-handle" title="ドラッグして並び替え" style="cursor:grab;color:var(--muted);display:flex;align-items:center;padding:2px 4px;border-radius:4px;user-select:none">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </span>
          <div class="card-label" style="margin-bottom:0;flex:1">項目 ${origIdx+1}</div>
          <button class="eval-edit-del" data-del-eval="${esc(item.id)}" title="削除" style="position:static">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M9 6V4h6v2"></path></svg>
          </button>
        </div>
        <input class="edit-input" style="margin-bottom:8px;font-weight:700"
          value="${esc(item.task)}"
          data-idx="${origIdx}" data-field="task"
          oninput="scenario.evaluations[${origIdx}].task=this.value;scheduleSave()">
        <textarea class="edit-input" style="min-height:80px"
          data-idx="${origIdx}" data-field="explanation"
          oninput="scenario.evaluations[${origIdx}].explanation=this.value;scheduleSave()">${esc(item.explanation)}</textarea>
      </div>`;
    } else {
      html += `<div class="eval-item">
        <div class="eval-row">
          <div class="eval-task">${esc(item.task)}</div>
          <div class="eval-btns">
            <button class="eval-btn ${res==='ok'?'ok':''}" data-eval-id="${esc(item.id)}" data-eval-val="ok">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </button>
            <button class="eval-btn ${res==='ng'?'ng':''}" data-eval-id="${esc(item.id)}" data-eval-val="ng">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            </button>
          </div>
        </div>
        ${res === 'ng' ? `
        <div class="eval-feedback">
          <div class="eval-feedback-lbl">指導根拠・フィードバック</div>
          <div class="eval-feedback-txt">${esc(item.explanation)}</div>
        </div>` : ''}
      </div>`;
    }
  });

  html += `<hr class="divider">`;
  if (e) {
    html += `<div>
      <div class="card-label" style="color:var(--indigo)">Take-home Message</div>
      <textarea class="edit-input" style="min-height:90px;font-weight:700"
        oninput="scenario.info.takeHomeMessage=this.value;scheduleSave()">${esc(scenario.info.takeHomeMessage||'')}</textarea>
    </div>`;
    html += `<button class="add-eval-row" data-add-eval="1">＋ 評価項目を追加</button>`;
  } else {
    html += `<div class="thm-card">
      <div class="thm-label">Take-home Message</div>
      <div class="thm-text">"${esc(scenario.info.takeHomeMessage||'本日の実習のまとめをここに設定できます。')}"</div>
    </div>`;
  }

  el.innerHTML = html;

  // ── クリックイベント委譲 ──
  el.onclick = (ev) => {
    const delBtn = ev.target.closest('[data-del-eval]');
    if (delBtn) { deleteEvalItem(delBtn.getAttribute('data-del-eval')); return; }
    if (ev.target.closest('[data-add-eval]')) { addEvalItem(); return; }
    const evalBtn = ev.target.closest('[data-eval-id]');
    if (evalBtn) {
      const id  = evalBtn.getAttribute('data-eval-id');
      const val = evalBtn.getAttribute('data-eval-val');
      evalResults[id] = evalResults[id] === val ? undefined : val;
      scheduleSave();
      renderEval();
    }
  };

  // ── ドラッグ&ドロップで並び替え（編集モードのみ）──
  if (e) {
    initEvalDragSort(el);
  }
}

/* ── 評価項目ドラッグ&ドロップ ── */
let _dragSrc = null;

function initEvalDragSort(container) {
  const items = container.querySelectorAll('.eval-edit-box');
  items.forEach((item) => {
    item.addEventListener('dragstart', (ev) => {
      _dragSrc = item;
      ev.dataTransfer.effectAllowed = 'move';
      setTimeout(() => item.style.opacity = '0.4', 0);
    });
    item.addEventListener('dragend', () => {
      item.style.opacity = '';
      container.querySelectorAll('.eval-edit-box').forEach(i => {
        i.style.borderColor = '';
        i.style.borderTopColor = '';
      });
    });
    item.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      if (item !== _dragSrc) {
        item.style.borderTopColor = 'var(--blue)';
      }
    });
    item.addEventListener('dragleave', () => {
      item.style.borderTopColor = '';
    });
    item.addEventListener('drop', (ev) => {
      ev.preventDefault();
      if (!_dragSrc || _dragSrc === item) return;

      const srcId = _dragSrc.getAttribute('data-eid');
      const dstId = item.getAttribute('data-eid');
      const srcIdx = scenario.evaluations.findIndex(x => x.id === srcId);
      const dstIdx = scenario.evaluations.findIndex(x => x.id === dstId);
      if (srcIdx < 0 || dstIdx < 0) return;

      // 配列を並び替え
      const moved = scenario.evaluations.splice(srcIdx, 1)[0];
      scenario.evaluations.splice(dstIdx, 0, moved);

      scheduleSave();
      renderEval();
    });
  });
}

/* ── ライブラリ一覧 ────────────────────────────────── */
function renderLibraryList() {
  const body = document.getElementById('lib-body');
  let html = `<div class="lib-actions">
    <button class="lib-act" data-act="new">＋ 新規作成</button>
    <button class="lib-act" data-act="dup">今の想定を複製</button>
    <button class="lib-act" data-act="export-all">全部を書き出す</button>
    <button class="lib-act" data-act="import-file">ファイルから読み込む</button>
  </div>
  <div class="lib-note">今の想定：<b>${esc(scenario.title)}</b>${isDirty() ? '<span class="lib-dirty">保存していない変更あり</span>' : ''}</div>`;
  if (!savedList.length) {
    html += `<div style="text-align:center;padding:48px 0;color:var(--muted);font-weight:700">保存されたデータがありません</div>`;
  } else {
    html += savedList.map(s => `
    <div class="s-item${s.id === scenario.id ? ' s-item-cur' : ''}" data-sid="${esc(s.id)}">
      <div style="min-width:0;flex:1">
        <div style="font-weight:700;font-size:14px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.title)}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">
          ${esc(s.info?.age||'')} ${esc(s.info?.gender||'')} &bull; ${(s.phases||[]).length} フェーズ${s.id === scenario.id ? ' &bull; 表示中' : ''}
        </div>
      </div>
      <button class="s-item-del" data-del="${esc(s.id)}" title="ライブラリから消す">
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  `).join('');
  }
  body.innerHTML = html;

  body.onclick = (e) => {
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.getAttribute('data-act');
      if (a === 'new') newScenario();
      else if (a === 'dup') duplicateScenario();
      else if (a === 'export-all') exportAllFile();
      else if (a === 'import-file') pickFile();
      return;
    }
    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      e.stopPropagation();
      deleteScenario(delBtn.getAttribute('data-del'));
      return;
    }
    const item = e.target.closest('[data-sid]');
    if (item) loadScenario(item.getAttribute('data-sid'));
  };
}

/* ── ファイルの書き出し・読み込み ──────────────────── */
const FILE_APP = 'ems-simulator';

function today() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

function downloadJSON(obj, name) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/:*?"<>|\s]+/g, '_');
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCurrentFile() {
  downloadJSON(scenario, `救急Sim_${scenario.title || '想定'}_${today()}.json`);
}

function exportAllFile() {
  if (!savedList.length && !records.length) { showToast('書き出すデータがありません'); return; }
  downloadJSON({ app: FILE_APP, version: 1, exportedAt: new Date().toISOString(), scenarios: savedList, records },
    `救急Sim_全部_${today()}.json`);
  showToast(`想定${savedList.length}件・記録${records.length}件を書き出しました`);
}

function pickFile() {
  const inp = document.getElementById('file-input');
  inp.value = '';
  inp.click();
}

function onFilePicked(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    let obj;
    try { obj = JSON.parse(reader.result); }
    catch (e) { alert('このファイルは読み込めません（形式が違います）。'); return; }
    if (obj && obj.app === FILE_APP && Array.isArray(obj.scenarios)) mergeAll(obj);
    else if (isScenario(obj)) loadImported(obj);
    else alert('このアプリで書き出したファイルではないようです。');
  };
  reader.readAsText(f);
}

function isScenario(o) {
  return !!(o && typeof o.title === 'string' && Array.isArray(o.phases) && o.phases.length);
}

// 足りない項目を補って、画面が崩れないようにする
function normalizeScenario(o) {
  o.id = o.id ? String(o.id) : uid();
  o.info = Object.assign({}, o.info || {});
  if (!Array.isArray(o.evaluations)) o.evaluations = [];
  o.evaluations.forEach(v => { if (!v.id) v.id = uid(); });
  o.phases.forEach(p => {
    if (!p.id) p.id = uid();
    p.abcde  = Object.assign({}, p.abcde || {});
    p.vitals = Object.assign({}, p.vitals || {});
  });
  return o;
}

// 1件の想定を読み込む。ライブラリにある別の中身と同じIDなら、上書きしないよう新しいIDにする
function loadImported(obj) {
  if (!confirmDiscard()) return false;
  const c = normalizeScenario(clone(obj));
  const same = savedList.find(x => x.id === c.id);
  if (same && JSON.stringify(same) !== JSON.stringify(c)) c.id = uid();
  scenario    = c;
  phaseIdx    = -1;
  evalResults = {};
  closeModal('modal-io');
  closeModal('modal-lib');
  saveDraftLocal();
  renderAll();
  showToast(same && same.id === c.id ? '読み込みました' : '読み込みました。保存するとライブラリに入ります');
  return true;
}

// 全部の書き出しファイルを、今のライブラリと記録に足す（今あるものは消さない）
function mergeAll(obj) {
  let addS = 0, skipS = 0, addR = 0;
  obj.scenarios.filter(isScenario).forEach(s0 => {
    const s = normalizeScenario(clone(s0));
    const same = savedList.find(x => x.id === s.id);
    if (same && JSON.stringify(same) === JSON.stringify(s)) { skipS++; return; }
    if (same) s.id = uid();
    savedList.push(s);
    addS++;
  });
  (Array.isArray(obj.records) ? obj.records : []).forEach(r => {
    if (!r || !r.id || !Array.isArray(r.items) || records.some(x => x.id === r.id)) return;
    records.push(r);
    addR++;
  });
  records.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  saveDraftLocal();
  renderLibraryList();
  alert(`読み込みました。\n想定：${addS}件を追加${skipS ? `（同じもの${skipS}件は飛ばしました）` : ''}\n評価の記録：${addR}件を追加`);
}

/* ── 評価の記録 ────────────────────────────────────── */
function evalCounts(items) {
  const c = { ok: 0, ng: 0, none: 0 };
  items.forEach(i => { if (i.res === 'ok') c.ok++; else if (i.res === 'ng') c.ng++; else c.none++; });
  return c;
}

function currentEvalItems() {
  return scenario.evaluations.map(v => ({ task: v.task, explanation: v.explanation, res: evalResults[v.id] || '' }));
}

function openRecordSave() {
  if (!scenario.evaluations.length) { showToast('評価項目がありません'); return; }
  const c = evalCounts(currentEvalItems());
  document.getElementById('rec-summary').innerHTML =
    `<b>${esc(scenario.title)}</b><br>○ ${c.ok}　× ${c.ng}　未評価 ${c.none}`;
  document.getElementById('rec-trainee').value = '';
  document.getElementById('rec-memo').value = '';
  openModal('modal-rec-save');
  setTimeout(() => document.getElementById('rec-trainee').focus(), 50);
}

function saveRecord() {
  const trainee = document.getElementById('rec-trainee').value.trim();
  if (!trainee) { alert('受講者（隊名・名前など）を入れてください。'); return; }
  const items = currentEvalItems();
  const c = evalCounts(items);
  if (c.none && !confirm(`まだ評価していない項目が${c.none}つあります。このまま記録しますか？`)) return;
  records.unshift({
    id: uid(),
    date: new Date().toISOString(),
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    trainee,
    memo: document.getElementById('rec-memo').value.trim(),
    items
  });
  saveDraftLocal();
  closeModal('modal-rec-save');
  showToast('評価を記録しました');
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function openRecords() {
  renderRecordList();
  openModal('modal-records');
}

function renderRecordList() {
  const body = document.getElementById('records-body');
  document.getElementById('records-title').textContent = '評価の記録';
  if (!records.length) {
    body.innerHTML = `<div style="text-align:center;padding:48px 0;color:var(--muted);font-weight:700">記録はまだありません<br><span style="font-size:12px">活動評価表の「記録する」から残せます</span></div>`;
    body.onclick = null;
    return;
  }
  body.innerHTML = records.map(r => {
    const c = evalCounts(r.items || []);
    return `<div class="s-item" data-rid="${esc(r.id)}">
      <div style="min-width:0;flex:1">
        <div style="font-weight:700;font-size:14px;color:var(--text)">${esc(r.trainee)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;font-weight:700">${esc(fmtDate(r.date))} &bull; ${esc(r.scenarioTitle)}</div>
      </div>
      <div class="rec-count"><span class="rc-ok">○${c.ok}</span><span class="rc-ng">×${c.ng}</span></div>
    </div>`;
  }).join('');
  body.onclick = (e) => {
    const it = e.target.closest('[data-rid]');
    if (it) renderRecordDetail(it.getAttribute('data-rid'));
  };
}

function recordHTML(r) {
  const c = evalCounts(r.items || []);
  return `<div class="rec-head">
      <div><span class="rec-k">受講者</span>${esc(r.trainee)}</div>
      <div><span class="rec-k">日時</span>${esc(fmtDate(r.date))}</div>
      <div><span class="rec-k">想定</span>${esc(r.scenarioTitle)}</div>
      <div><span class="rec-k">結果</span>○ ${c.ok}　× ${c.ng}　未評価 ${c.none}</div>
    </div>
    <table class="rec-table"><thead><tr><th style="width:2.5em">No</th><th>評価項目</th><th style="width:4.2em;white-space:nowrap">結果</th></tr></thead><tbody>
    ${(r.items || []).map((i, n) => `<tr class="${i.res === 'ng' ? 'rec-ng' : ''}">
      <td>${n+1}</td>
      <td><b>${esc(i.task)}</b>${i.res === 'ng' && i.explanation ? `<div class="rec-exp">${esc(i.explanation)}</div>` : ''}</td>
      <td class="rec-res">${i.res === 'ok' ? '○' : i.res === 'ng' ? '×' : '−'}</td></tr>`).join('')}
    </tbody></table>
    ${r.memo ? `<div class="rec-memo"><span class="rec-k">メモ</span><div>${esc(r.memo)}</div></div>` : ''}`;
}

function renderRecordDetail(id) {
  const r = records.find(x => x.id === id);
  if (!r) return;
  const body = document.getElementById('records-body');
  document.getElementById('records-title').textContent = '記録の内容';
  body.innerHTML = `<div class="rec-btns">
      <button class="btn-ghost" data-rec="back">← 一覧へ</button>
      <span style="flex:1"></span>
      <button class="btn-ghost rec-del" data-rec="del">消す</button>
      <button class="btn-primary" data-rec="print">印刷</button>
    </div>
    <div class="rec-card">${recordHTML(r)}</div>`;
  body.onclick = (e) => {
    const b = e.target.closest('[data-rec]');
    if (!b) return;
    const a = b.getAttribute('data-rec');
    if (a === 'back') renderRecordList();
    else if (a === 'print') printRecord(r);
    else if (a === 'del') {
      if (!confirm(`${r.trainee}さんの記録（${fmtDate(r.date)}）を消しますか？\n消した記録は元に戻せません。`)) return;
      records = records.filter(x => x.id !== id);
      saveDraftLocal();
      renderRecordList();
      showToast('記録を消しました');
    }
  };
}

function printRecord(r) {
  document.getElementById('print-area').innerHTML =
    `<h1>活動評価表</h1>${recordHTML(r)}<div class="print-foot">救急シミュレーション管理システム</div>`;
  window.print();
}

/* ── レスポンシブ ──────────────────────────────────── */
function handleResize() {
  if (window.innerWidth >= 1024) {
    document.getElementById('sec-monitor').classList.remove('hidden');
    document.getElementById('sec-eval').classList.remove('hidden');
  } else if (activeTab) {
    switchTab(activeTab);
  }
}

/* ── 起動 ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadDraftLocal();
  renderAll();
  renderLibraryList();
  handleResize();

  // イベント設定
  document.getElementById('btn-edit').addEventListener('click', () => setEditMode(!editMode));
  document.getElementById('btn-save').addEventListener('click', saveScenario);
  document.getElementById('btn-library').addEventListener('click', () => {
    renderLibraryList();
    openModal('modal-lib');
  });
  document.getElementById('btn-io').addEventListener('click', openIO);
  document.getElementById('btn-import').addEventListener('click', importIO);
  document.getElementById('btn-copy').addEventListener('click', copyIO);
  document.getElementById('btn-io-export').addEventListener('click', exportCurrentFile);
  document.getElementById('btn-io-file').addEventListener('click', pickFile);
  document.getElementById('file-input').addEventListener('change', onFilePicked);
  document.getElementById('btn-reset').addEventListener('click', resetEval);
  document.getElementById('btn-rec').addEventListener('click', openRecordSave);
  document.getElementById('btn-rec-list').addEventListener('click', openRecords);
  document.getElementById('btn-rec-save').addEventListener('click', saveRecord);

  // モーダルの背景クリックで閉じる
  document.querySelectorAll('.overlay').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target === el) closeModal(el.id);
    });
  });

  window.addEventListener('resize', handleResize);
});
