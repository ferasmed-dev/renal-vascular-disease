// Renal vascular disease simulator — pure model (no DOM).
// Each entity is a small, deliberately simple time-course model. Values marked "Model" are
// tuning choices chosen to reproduce the textbook course, not measured constants.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const bell = (t, mu, sd) => Math.exp(-((t - mu) ** 2) / (2 * sd * sd));
const sigm = (x) => 1 / (1 + Math.exp(-x));
/** Steady-state creatinine from GFR (Model: Cr ≈ 0.9 mg/dL at 100 mL/min, inverse relation). */
export const crFromFg = (fg) => clamp(90 / Math.max(fg, 4), 0.4, 20);

/** Gauges: unit, decimals, normal range (adult reference values). */
export const GAUGES = {
  pas: { unit: 'mmHg', dec: 0, normal: [90, 139] },          // ESC/ESH: HTA ≥ 140/90
  tad: { unit: 'mmHg', dec: 0, normal: [60, 89] },
  fg: { unit: 'mL/min', dec: 0, normal: [90, 140], yMin: 0 }, // KDIGO G1 ≥ 90
  cr: { unit: 'mg/dL', dec: 1, normal: [0.6, 1.2], yMin: 0 },
  renina: { unit: '× N', dec: 1, normal: [0.5, 2], yMin: 0 },  // activity relative to normal (Model)
  k: { unit: 'mEq/L', dec: 1, normal: [3.5, 5.0] },
  ldh: { unit: 'U/L', dec: 0, normal: [120, 250], yMin: 0 },
  plaq: { unit: '×10³/µL', dec: 0, normal: [150, 400], yMin: 0 },
  hb: { unit: 'g/dL', dec: 1, normal: [12, 17] },
  eos: { unit: '/µL', dec: 0, normal: [0, 500], yMin: 0 },
  c3: { unit: 'mg/dL', dec: 0, normal: [90, 180] },
  necrosis: { unit: '%', dec: 0, normal: [0, 0], yMin: 0, yMax: 100 },
  diuresis: { unit: 'mL/h', dec: 0, normal: [40, 150], yMin: 0 },
  neuro: { unit: '0–3', dec: 1, normal: [0, 0.4], yMin: 0, yMax: 3 }, // neurological involvement index (Model)
};

const R = (key, min, max, step, def, unit = '', dec = 0) => ({ key, min, max, step, def, unit, dec });
const Ch = (key, options, def) => ({ key, type: 'choice', options, def });

export const ENTITIES = [
  { key: 'nefroangio', loc: 'arteriola', unit: 'years', tMax: 20, dt: 0.25, treat: true,
    params: [R('pas', 140, 200, 1, 165, 'mmHg'), R('fg0', 60, 120, 1, 95, 'mL/min'), R('objetivo', 110, 140, 1, 130, 'mmHg')],
    tiles: ['pas', 'fg', 'cr'], charts: ['fg', 'pas'], steps: ['hta', 'hialinosis', 'erc', 'triple', 'sobretto'] },
  { key: 'hta_maligna', loc: 'arteriola', unit: 'days', tMax: 28, dt: 0.25, treat: true,
    params: [R('tad', 110, 150, 1, 135, 'mmHg'), Ch('fondo', ['papila', 'retino3'], 'papila')],
    tiles: ['tad', 'fg', 'k', 'renina', 'ldh'], charts: ['tad', 'fg', 'k'], steps: ['tad130', 'isquemia', 'sraa', 'hipok', 'mat', 'ir', 'control'] },
  { key: 'isquemica', loc: 'arteria', unit: 'months', tMax: 24, dt: 0.25, treat: true,
    params: [R('estenosis', 40, 95, 1, 80, '%'), Ch('lado', ['bilateral', 'unilateral'], 'bilateral'), Ch('tto', ['ieca', 'revasc'], 'ieca')],
    tiles: ['pas', 'fg', 'cr', 'renina'], charts: ['fg', 'pas'], steps: ['estenosis', 'hipoxia', 'sraa', 'fibrosis', 'ieca_cr', 'revasc'] },
  { key: 'fibrodisplasia', loc: 'arteria', unit: 'months', tMax: 24, dt: 0.25, treat: true,
    params: [R('edad', 16, 50, 1, 28, ''), R('estenosis', 50, 90, 1, 75, '%'), Ch('lado', ['unilateral', 'bilateral'], 'unilateral'), Ch('tto', ['angioplastia', 'ieca'], 'angioplastia')],
    tiles: ['pas', 'k', 'renina', 'fg'], charts: ['pas', 'k'], steps: ['estenosis', 'sraa', 'hta', 'hipok', 'tto'] },
  { key: 'infarto', loc: 'segmentaria', unit: 'hours', tMax: 48, dt: 0.25, treat: true,
    params: [Ch('arteria', ['principal', 'segmentaria'], 'principal'), R('hora', 1, 30, 0.5, 4, 'h', 1), Ch('monorreno', ['no', 'si'], 'no')],
    tiles: ['fg', 'ldh', 'diuresis', 'necrosis'], charts: ['fg', 'ldh'], steps: ['oclusion', 'dolor', 'necrosis', 'ldh', 'reperfusion', 'anuria'] },
  { key: 'ateroembolia', loc: 'arteriola', unit: 'weeks', tMax: 12, dt: 0.1, treat: false,
    params: [R('carga', 1, 10, 1, 6, ''), R('fg0', 30, 90, 1, 60, 'mL/min')],
    tiles: ['fg', 'eos', 'c3', 'cr'], charts: ['fg', 'eos'], steps: ['cateterismo', 'cristales', 'livedo', 'eosinofilia', 'c3', 'ir'] },
  { key: 'shu_tipico', loc: 'capilar', unit: 'days', tMax: 21, dt: 0.25, treat: true,
    params: [R('toxina', 1, 10, 1, 6, '')],
    tiles: ['plaq', 'hb', 'ldh', 'fg'], charts: ['plaq', 'fg', 'hb'], steps: ['diarrea', 'toxina', 'endotelio', 'plaquetas', 'hemolisis', 'ira', 'recupera'] },
  { key: 'shu_atipico', loc: 'capilar', unit: 'days', tMax: 30, dt: 0.25, treat: true,
    params: [R('actividad', 1, 10, 1, 7, ''), R('dia', 1, 20, 1, 4, '')],
    tiles: ['plaq', 'ldh', 'fg', 'hb'], charts: ['plaq', 'fg'], steps: ['complemento', 'endotelio', 'mat', 'ira', 'eculizumab'] },
  { key: 'ptt', loc: 'capilar', unit: 'days', tMax: 14, dt: 0.25, treat: true,
    params: [R('adamts', 0, 30, 1, 5, '%'), R('dia', 0, 6, 0.5, 1, '', 1)],
    tiles: ['plaq', 'neuro', 'ldh', 'fg'], charts: ['plaq', 'neuro'], steps: ['adamts', 'vwf', 'microtrombos', 'plaquetas', 'neuro', 'plasmaferesis'] },
  { key: 'vasculitis', loc: 'glomerulo', unit: 'weeks', tMax: 16, dt: 0.1, treat: true,
    params: [Ch('vaso', ['pequeno', 'mediano'], 'pequeno'), R('actividad', 1, 10, 1, 7, ''), R('semana', 1, 10, 0.5, 3, '', 1)],
    tiles: ['fg', 'cr', 'pas'], charts: ['fg', 'pas'], steps: ['inflamacion', 'necrosis_fibrinoide', 'gnrp', 'infartos', 'induccion'] },
];

export function defaults(key) {
  const e = ENTITIES.find(x => x.key === key);
  return Object.fromEntries(e.params.map(p => [p.key, p.def]));
}

/* ---------- generic runner ---------- */
function runner(e, init, step) {
  const points = [], events = [], fired = new Set();
  const emit = (t, key, args = []) => { if (fired.has(key)) return; fired.add(key); events.push({ t, key, args }); };
  const st = { ...init };
  const n = Math.round(e.tMax / e.dt);
  for (let i = 0; i <= n; i++) {
    const t = +(i * e.dt).toFixed(6);
    const o = step(st, t, e.dt, emit);
    for (const k of Object.keys(o.g)) o.g[k] = Number.isFinite(o.g[k]) ? Math.max(0, o.g[k]) : 0;
    points.push({ t, g: o.g, active: o.active, lesion: clamp(o.lesion ?? 0, 0, 1), badge: o.badge || null });
  }
  return { points, events };
}
const ckdEvents = (fg, t, emit) => {
  if (fg < 60) emit(t, 'g3', [60]);
  if (fg < 30) emit(t, 'g4', [30]);
  if (fg < 15) emit(t, 'g5', [15]);
};

/* ---------- entity models ---------- */
const MODELS = {
  // Hypertensive nephrosclerosis: GFR loss accelerates with systolic BP above 130 (Model: +0.08 mL/min/yr per mmHg),
  // on top of ~1 mL/min/yr age-related loss. Treatment lowers BP to the chosen target; < 120 adds ischaemic loss.
  nefroangio(p, treated) {
    const e = ENTITIES[0];
    return runner(e, { fg: p.fg0, pas: p.pas }, (s, t, dt, emit) => {
      if (treated) { s.pas = s.pas + (p.objetivo - s.pas) * Math.min(1, dt / 0.5); if (t === 0) emit(t, 'tto_inicio', [p.objetivo]); }
      const over = Math.max(0, s.pas - 130);
      let loss = 1 + 0.08 * over;
      const sobretto = treated && p.objetivo < 120;
      if (sobretto) { loss += 1.5; emit(t, 'sobretto'); }
      if (t > 0) s.fg = Math.max(4, s.fg - loss * dt);
      ckdEvents(s.fg, t, emit);
      const active = ['hta'];
      if (t >= 1 && s.pas > 140) active.push('hialinosis');
      if (s.fg < 60) active.push('erc');
      if (treated) active.push('triple');
      if (sobretto) active.push('sobretto');
      return { g: { pas: s.pas, fg: s.fg, cr: crFromFg(s.fg) }, active, lesion: (p.fg0 - s.fg) / 70 + over / 140,
        badge: s.fg < 15 ? 'g5' : s.fg < 60 ? 'erc' : null };
    });
  },

  // Malignant hypertension: TAD ≥ 130 → microvascular ischaemia → renin/aldosterone ↑ (hypoK, alkalosis),
  // schistocytic haemolysis and progressive renal failure. Treatment: controlled BP lowering over ~3 days (Model).
  hta_maligna(p, treated) {
    const e = ENTITIES[1];
    const severe = p.tad >= 130;
    const sev = clamp((p.tad - 115) / 25, 0, 1.4);
    return runner(e, { tad: p.tad, fg: 85, ren: 1, k: 4.2, ldh: 200, plaq: 240 }, (s, t, dt, emit) => {
      const controlled = treated && t > 0;
      if (controlled) { s.tad += (95 - s.tad) * Math.min(1, dt / 1.5); emit(0, 'tto_inicio_bp'); }
      const drive = clamp((s.tad - 110) / 25, 0, 1.4) * (severe ? 1 : 0.25);
      const tgt = { ren: 1 + 4 * drive, k: 4.2 - 1.3 * drive, ldh: 200 + 450 * drive, plaq: 240 - 120 * drive };
      const tau = 2.5;
      for (const k of Object.keys(tgt)) s[k] += (tgt[k] - s[k]) * Math.min(1, dt / tau);
      if (t > 0) {
        if (drive > 0.3) s.fg = Math.max(6, s.fg - 2.2 * drive * dt);
        else if (controlled) s.fg = Math.min(60, s.fg + 0.6 * dt);
      }
      if (severe && t >= 0) emit(0, 'tad130', [p.tad]);
      if (s.k < 3.5) emit(t, 'hipok');
      if (s.ldh > 300) emit(t, 'esquistocitos');
      ckdEvents(s.fg, t, emit);
      const active = [];
      if (s.tad >= 130) active.push('tad130');
      if (drive > 0.3) active.push('isquemia');
      if (s.ren > 2) active.push('sraa');
      if (s.k < 3.5) active.push('hipok');
      if (s.ldh > 300) active.push('mat');
      if (s.fg < 60) active.push('ir');
      if (controlled) active.push('control');
      return { g: { tad: s.tad, pas: s.tad + 55, fg: s.fg, cr: crFromFg(s.fg), renina: s.ren, k: s.k, ldh: s.ldh, plaq: s.plaq },
        active, lesion: drive * 0.8 + (85 - s.fg) / 120,
        badge: severe ? (p.fondo === 'papila' ? 'maligna' : 'acelerada') : null };
    });
  },

  // Ischaemic nephropathy (atherosclerotic stenosis). Haemodynamic significance ramps from 60 % to 95 % (Model);
  // > 70 % is the diagnostic threshold. Bilateral: no compensating kidney → faster loss; ACEi/ARB → acute GFR drop.
  isquemica(p, treated) {
    const e = ENTITIES[2];
    const sig = clamp((p.estenosis - 60) / 35, 0, 1);
    const bil = p.lado === 'bilateral';
    return runner(e, { fg: 70, pas: 140, ren: 1, dropped: false, revasc: false }, (s, t, dt, emit) => {
      let pasT = 135 + 35 * sig + (bil ? 10 : 0);
      let renT = 1 + (bil ? 2 : 4) * sig;
      let loss = (bil ? 1.0 : 0.35) * sig;
      if (treated && p.tto === 'ieca' && t >= 0.5) {
        pasT = bil ? pasT - 15 : 130;
        renT = renT * 1.3;
        if (bil && sig > 0.3 && !s.dropped) { s.fg *= 1 - 0.3 * sig; s.dropped = true; emit(t, 'cr_ieca'); }
        if (!bil) emit(t, 'ieca_ok');
      }
      if (treated && p.tto === 'revasc' && t >= 1) {
        if (p.estenosis >= 70) { s.revasc = true; pasT = 135; renT = 1; loss = 0.05; emit(t, 'revasc_ok'); }
        else emit(t, 'revasc_no');
      }
      s.pas += (pasT - s.pas) * Math.min(1, dt / 0.75);
      s.ren += (renT - s.ren) * Math.min(1, dt / 0.75);
      if (t > 0) s.fg = Math.max(5, s.fg - loss * dt);
      if (p.estenosis > 70) emit(0, 'significativa', [p.estenosis]);
      ckdEvents(s.fg, t, emit);
      const active = ['estenosis'];
      if (sig > 0.3) active.push('hipoxia');
      if (s.ren > 2) active.push('sraa');
      if (t > 2 && loss > 0.2) active.push('fibrosis');
      if (s.dropped) active.push('ieca_cr');
      if (s.revasc) active.push('revasc');
      return { g: { pas: s.pas, fg: s.fg, cr: crFromFg(s.fg), renina: s.ren }, active,
        lesion: sig * (s.revasc ? 0.2 : 1), badge: p.estenosis > 70 ? 'significativa' : null };
    });
  },

  // Fibromuscular dysplasia: young patient, renin-dependent HTA with hypokalaemia (secondary aldosteronism).
  // Angioplasty: good response. ACEi: fine if unilateral; bilateral → hypotension and GFR drop.
  fibrodisplasia(p, treated) {
    const e = ENTITIES[3];
    const sig = clamp((p.estenosis - 50) / 40, 0, 1);
    const bil = p.lado === 'bilateral';
    return runner(e, { pas: 125, k: 4.2, ren: 1, fg: 105, dropped: false }, (s, t, dt, emit) => {
      let pasT = 130 + 45 * sig, kT = 4.2 - 1.2 * sig, renT = 1 + (bil ? 2 : 3.5) * sig;
      if (treated && p.tto === 'angioplastia' && t >= 1) { pasT = 124; kT = 4.2; renT = 1; emit(t, 'angio_ok'); }
      if (treated && p.tto === 'ieca' && t >= 0.5) {
        if (bil) { pasT = 102; if (!s.dropped) { s.fg *= 0.7; s.dropped = true; emit(t, 'hipotension'); } }
        else { pasT = 128; kT = 4.1; emit(t, 'ieca_ok'); }
      }
      s.pas += (pasT - s.pas) * Math.min(1, dt / 0.5);
      s.k += (kT - s.k) * Math.min(1, dt / 0.5);
      s.ren += (renT - s.ren) * Math.min(1, dt / 0.5);
      if (s.k < 3.5) emit(t, 'hipok');
      const active = ['estenosis'];
      if (s.ren > 2) active.push('sraa');
      if (s.pas >= 140) active.push('hta');
      if (s.k < 3.5) active.push('hipok');
      if (treated && t >= (p.tto === 'angioplastia' ? 1 : 0.5)) active.push('tto');
      return { g: { pas: s.pas, k: s.k, renina: s.ren, fg: s.fg, cr: crFromFg(s.fg) }, active,
        lesion: sig * (treated && p.tto === 'angioplastia' && t >= 1 ? 0.15 : 1),
        badge: p.edad < 35 ? 'joven' : null };
    });
  },

  // Renal infarction: necrosis of the occluded territory follows a sigmoid centred on the reperfusion window
  // (< 6 h main artery, < 24 h segmental). Fibrinolysis at "hora" freezes necrosis if done in time.
  infarto(p, treated) {
    const e = ENTITIES[4];
    const w = p.arteria === 'principal' ? 6 : 24;
    const share = p.arteria === 'principal' ? (p.monorreno === 'si' ? 1 : 0.5) : 0.15;
    const N = (t) => sigm((t - w) / (w / 5)) - sigm(-5);
    return runner(e, { nec: 0, reperf: false }, (s, t, dt, emit) => {
      if (treated && t >= p.hora && !s.reperf) { s.reperf = true; emit(t, p.hora <= w ? 'reperf_ok' : 'reperf_tarde', [w]); }
      if (!s.reperf) s.nec = clamp(N(t) / (1 - sigm(-5)), 0, 1);
      if (t >= w) emit(t, 'ventana', [w]);
      const lost = s.reperf ? share * s.nec : share;
      const fg = 100 * (1 - lost);
      const ldh = 180 + 1900 * share * s.nec;
      const diur = 70 * (1 - lost);
      if (fg < 10) emit(t, 'anuria');
      emit(0, 'oclusion');
      const active = ['oclusion'];
      if (t < 12) active.push('dolor');
      if (s.nec > 0.1) active.push('necrosis');
      if (ldh > 400) active.push('ldh');
      if (s.reperf) active.push('reperfusion');
      if (fg < 10) active.push('anuria');
      return { g: { fg, cr: crFromFg(fg), ldh, diuresis: diur, necrosis: 100 * s.nec * (share >= 0.5 ? 1 : 1) }, active,
        lesion: s.reperf ? s.nec : Math.max(0.5, s.nec), badge: fg < 10 ? 'anuria' : null };
    });
  },

  // Cholesterol atheroembolism after an arterial catheterisation: GFR falls over days–weeks,
  // transient eosinophilia and mild complement consumption. No specific treatment.
  ateroembolia(p) {
    const e = ENTITIES[5];
    const lossMax = p.fg0 * 0.065 * p.carga;
    return runner(e, {}, (s, t, dt, emit) => {
      const fg = p.fg0 - lossMax * (1 - Math.exp(-t / 2.5));
      const eos = 200 + 130 * p.carga * bell(t, 2, 1.3) * (1 - Math.exp(-t / 0.4));
      const c3 = 110 - 3.5 * p.carga * bell(t, 2.5, 2);
      emit(0, 'cateterismo');
      if (eos > 500) emit(t, 'eosinofilia');
      if (c3 < 90) emit(t, 'c3');
      if (fg < p.fg0 * 0.8) emit(t, 'ir_progresiva');
      const active = ['cateterismo', 'cristales'];
      if (t > 0.5) active.push('livedo');
      if (eos > 500) active.push('eosinofilia');
      if (c3 < 90) active.push('c3');
      if (fg < p.fg0 * 0.9) active.push('ir');
      return { g: { fg, cr: crFromFg(fg), eos, c3 }, active, lesion: 0.3 + 0.07 * p.carga * (1 - Math.exp(-t / 2.5)) };
    });
  },

  // Typical (Shiga-toxin) HUS: bloody diarrhoea, then thrombocytopenia, haemolysis and AKI peaking ~day 8–9,
  // usually self-limited. Supportive care (transfusion, dialysis if needed) limits anaemia; it does not change GFR.
  shu_tipico(p, treated) {
    const e = ENTITIES[6];
    const k = p.toxina / 10;
    return runner(e, {}, (s, t, dt, emit) => {
      const b = bell(t, 8.5, 2.6);
      const plaq = 250 - 200 * k * b;
      let hb = 13.5 - 8 * k * bell(t, 9, 3);
      if (treated && hb < 8) { hb = 8; emit(t, 'transfusion'); }
      const ldh = 200 + 1400 * k * b;
      const fg = 100 - 92 * k * bell(t, 9, 2.8);
      emit(0, 'diarrea');
      if (plaq < 150) emit(t, 'trombopenia');
      if (fg < 15) emit(t, treated ? 'dialisis' : 'ira_grave');
      if (t > 14 && fg > 80) emit(t, 'recuperacion');
      const active = [];
      if (t < 5) active.push('diarrea');
      if (t >= 2 && t < 14) active.push('toxina');
      if (b > 0.2) active.push('endotelio');
      if (plaq < 150) active.push('plaquetas');
      if (ldh > 300) active.push('hemolisis');
      if (fg < 60) active.push('ira');
      if (t > 13 && fg > 70) active.push('recupera');
      return { g: { plaq, hb, ldh, fg, cr: crFromFg(fg) }, active, lesion: k * b,
        badge: plaq < 150 && ldh > 300 ? 'mat' : null };
    });
  },

  // Atypical HUS (complement dysregulation): persistent MAT and progressive renal failure.
  // Eculizumab normalises platelets within ~48 h; renal recovery is better the earlier it starts (Model).
  shu_atipico(p, treated) {
    const e = ENTITIES[7];
    const a = p.actividad / 10;
    return runner(e, { fg: 90, plaq: 220, ldh: 220, hb: 13, on: false }, (s, t, dt, emit) => {
      if (treated && t >= p.dia) { if (!s.on) emit(t, 'eculizumab'); s.on = true; }
      const tgt = s.on ? { plaq: 230, ldh: 210, hb: 12.5 } : { plaq: 220 - 170 * a, ldh: 220 + 900 * a, hb: 13 - 5 * a };
      s.plaq += (tgt.plaq - s.plaq) * Math.min(1, dt / (s.on ? 0.7 : 1.5));
      s.ldh += (tgt.ldh - s.ldh) * Math.min(1, dt / (s.on ? 2 : 1.5));
      s.hb += (tgt.hb - s.hb) * Math.min(1, dt / 4);
      if (t > 0) {
        if (s.on) { const cap = 90 * clamp(1 - 0.045 * p.dia, 0.15, 1); s.fg = Math.min(cap, s.fg + 1.2 * dt); }
        else s.fg = Math.max(5, s.fg - 3.2 * a * dt);
      }
      if (s.plaq < 150) emit(t, 'trombopenia');
      if (s.on && s.plaq > 150) emit(t, 'plaq_normal');
      ckdEvents(s.fg, t, emit);
      const active = ['complemento'];
      if (!s.on || t < p.dia + 2) active.push('endotelio');
      if (s.plaq < 150 && s.ldh > 300) active.push('mat');
      if (s.fg < 60) active.push('ira');
      if (s.on) active.push('eculizumab');
      return { g: { plaq: s.plaq, ldh: s.ldh, hb: s.hb, fg: s.fg, cr: crFromFg(s.fg) }, active,
        lesion: s.on ? 0.2 : 0.4 + 0.5 * a, badge: s.plaq < 150 && s.ldh > 300 ? 'mat' : null };
    });
  },

  // TTP: severe ADAMTS13 deficiency (< 10 %) → uncleaved vWF multimers → platelet microthrombi, predominantly
  // cerebral. Plasma exchange (standard care) restores ADAMTS13 activity.
  ptt(p, treated) {
    const e = ENTITIES[8];
    const sev = clamp((12 - p.adamts) / 12, 0, 1);
    return runner(e, { plaq: 230, neuro: 0, ldh: 200, fg: 95, on: false }, (s, t, dt, emit) => {
      if (treated && t >= p.dia && sev > 0) { if (!s.on) emit(t, 'plasmaferesis'); s.on = true; }
      const tgt = s.on ? { plaq: 220, neuro: 0, ldh: 220, fg: 92 } : { plaq: 230 - 225 * Math.sqrt(sev), neuro: 2.8 * sev, ldh: 200 + 1100 * sev, fg: 95 - 25 * sev };
      s.plaq += (tgt.plaq - s.plaq) * Math.min(1, dt / (s.on ? 1.8 : 1.2));
      s.neuro += (tgt.neuro - s.neuro) * Math.min(1, dt / (s.on ? 1.5 : 2.5));
      s.ldh += (tgt.ldh - s.ldh) * Math.min(1, dt / 2);
      s.fg += (tgt.fg - s.fg) * Math.min(1, dt / 3);
      if (sev > 0) emit(0, 'adamts_bajo', [p.adamts]);
      if (s.neuro > 1) emit(t, 'neuro');
      const active = [];
      if (sev > 0) active.push('adamts', 'vwf');
      if (sev > 0 && !s.on) active.push('microtrombos');
      if (s.plaq < 150) active.push('plaquetas');
      if (s.neuro > 0.5) active.push('neuro');
      if (s.on) active.push('plasmaferesis');
      return { g: { plaq: s.plaq, neuro: s.neuro, ldh: s.ldh, fg: s.fg, cr: crFromFg(s.fg) }, active,
        lesion: s.on ? 0.15 : 0.3 + 0.6 * sev, badge: p.adamts < 10 ? 'adamts' : null };
    });
  },

  // Vasculitis: small vessel → rapidly progressive GN (crescents); medium vessel (PAN) → stepwise renal infarcts
  // and renin-mediated HTA. Induction (MP pulses + RTX/CFM or avacopan) stops progression; recovery depends on delay.
  vasculitis(p, treated) {
    const e = ENTITIES[9];
    const a = p.actividad / 10;
    const small = p.vaso === 'pequeno';
    return runner(e, { fg: 90, pas: 125, on: false, inf: 0, last: -9 }, (s, t, dt, emit) => {
      if (treated && t >= p.semana) { if (!s.on) emit(t, 'induccion'); s.on = true; }
      if (t > 0) {
        if (small) {
          if (s.on) { const cap = 90 * clamp(1 - 0.07 * p.semana, 0.25, 1); s.fg = Math.min(cap, s.fg + 1.5 * dt); }
          else s.fg = Math.max(5, s.fg - 14 * a * dt);
        } else if (!s.on && t - s.last >= 3.5 - 2 * a) {
          s.inf++; s.last = t; s.fg = Math.max(5, s.fg * 0.86); emit(t, `infarto${s.inf}`, [s.inf]);
        }
      }
      const pasT = small ? 130 : (s.on ? 135 : 150 + Math.min(25, 4 * s.inf));
      s.pas += (pasT - s.pas) * Math.min(1, dt / 1);
      if (small && s.fg < 60) emit(t, 'gnrp');
      ckdEvents(s.fg, t, emit);
      const active = ['inflamacion', 'necrosis_fibrinoide'];
      if (small && !s.on) active.push('gnrp');
      if (!small && s.inf > 0) active.push('infartos');
      if (s.on) active.push('induccion');
      return { g: { fg: s.fg, cr: crFromFg(s.fg), pas: s.pas }, active,
        lesion: s.on ? 0.25 : 0.5 + 0.5 * a, badge: small ? 'gnrp' : 'pan' };
    });
  },
};

/** Run one entity. Returns { points:[{t, g, active, lesion, badge}], events:[{t, key, args}] }. */
export function simulate(key, params, treated = false) {
  const e = ENTITIES.find(x => x.key === key);
  if (!e) throw new Error(`unknown entity ${key}`);
  const p = { ...defaults(key), ...params };
  return MODELS[key](p, treated && e.treat);
}

/** Generic clinical scenarios (deep-linkable with ?preset=key). */
export const PRESETS = {
  hta_mal_controlada: { entity: 'nefroangio', params: { pas: 175, fg0: 95, objetivo: 130 } },
  sobretratamiento: { entity: 'nefroangio', params: { pas: 165, fg0: 70, objetivo: 112 } },
  hta_maligna_papila: { entity: 'hta_maligna', params: { tad: 140, fondo: 'papila' } },
  hta_acelerada: { entity: 'hta_maligna', params: { tad: 134, fondo: 'retino3' } },
  estenosis_bilateral_ieca: { entity: 'isquemica', params: { estenosis: 85, lado: 'bilateral', tto: 'ieca' } },
  estenosis_revasc: { entity: 'isquemica', params: { estenosis: 85, lado: 'bilateral', tto: 'revasc' } },
  fmd_joven: { entity: 'fibrodisplasia', params: { edad: 26, estenosis: 75, lado: 'unilateral', tto: 'angioplastia' } },
  fmd_bilateral_ieca: { entity: 'fibrodisplasia', params: { edad: 30, estenosis: 75, lado: 'bilateral', tto: 'ieca' } },
  infarto_precoz: { entity: 'infarto', params: { arteria: 'principal', hora: 3, monorreno: 'no' } },
  infarto_tardio: { entity: 'infarto', params: { arteria: 'principal', hora: 12, monorreno: 'no' } },
  infarto_monorreno: { entity: 'infarto', params: { arteria: 'principal', hora: 3, monorreno: 'si' } },
  ateroembolia_cateterismo: { entity: 'ateroembolia', params: { carga: 7, fg0: 60 } },
  shu_diarrea: { entity: 'shu_tipico', params: { toxina: 8 } },
  shu_atipico_precoz: { entity: 'shu_atipico', params: { actividad: 7, dia: 3 } },
  shu_atipico_tardio: { entity: 'shu_atipico', params: { actividad: 7, dia: 14 } },
  ptt_grave: { entity: 'ptt', params: { adamts: 3, dia: 1 } },
  vasculitis_anca: { entity: 'vasculitis', params: { vaso: 'pequeno', actividad: 7, semana: 2 } },
  pan: { entity: 'vasculitis', params: { vaso: 'mediano', actividad: 7, semana: 6 } },
};
