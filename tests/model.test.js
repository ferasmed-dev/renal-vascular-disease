import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTITIES, GAUGES, PRESETS, simulate, defaults, crFromFg } from '../src/model.js';
import { STR } from '../src/i18n.js';

const last = r => r.points[r.points.length - 1];
const at = (r, t) => r.points.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
const min = (r, g) => Math.min(...r.points.map(p => p.g[g]));
const max = (r, g) => Math.max(...r.points.map(p => p.g[g]));
const evs = r => r.events.map(e => e.key);

/* ---------- generic: every entity ---------- */
for (const e of ENTITIES) {
  test(`${e.key}: well-formed output (defaults, extremes, both arms)`, () => {
    const variants = [defaults(e.key)];
    for (const p of e.params.filter(q => q.type !== 'choice')) {
      variants.push({ ...defaults(e.key), [p.key]: p.min }, { ...defaults(e.key), [p.key]: p.max });
    }
    for (const p of e.params.filter(q => q.type === 'choice')) for (const o of p.options) variants.push({ ...defaults(e.key), [p.key]: o });
    for (const v of variants) for (const tr of [false, true]) {
      const r = simulate(e.key, v, tr);
      assert.equal(r.points.length, Math.round(e.tMax / e.dt) + 1);
      for (let i = 1; i < r.points.length; i++) assert.ok(r.points[i].t > r.points[i - 1].t);
      for (const pt of r.points) {
        for (const g of [...e.tiles, ...e.charts]) {
          assert.ok(Number.isFinite(pt.g[g]) && pt.g[g] >= 0, `${e.key} ${g}=${pt.g[g]}`);
          assert.ok(GAUGES[g], `gauge ${g} defined`);
        }
        for (const a of pt.active) assert.ok(e.steps.includes(a), `${e.key} unknown step ${a}`);
        assert.ok(pt.lesion >= 0 && pt.lesion <= 1);
      }
      for (const ev of r.events) assert.ok(ev.t >= 0 && ev.t <= e.tMax);
    }
  });
}

test('pure: same input → same output, params not mutated', () => {
  for (const e of ENTITIES) {
    const p = defaults(e.key); const copy = JSON.stringify(p);
    assert.deepEqual(simulate(e.key, p, true), simulate(e.key, p, true));
    assert.equal(JSON.stringify(p), copy);
  }
});

test('creatinine falls as GFR rises and is ~0.9 at 100 mL/min', () => {
  assert.ok(Math.abs(crFromFg(100) - 0.9) < 1e-9);
  assert.ok(crFromFg(30) > crFromFg(60));
});

test('i18n: every key used by the model exists in ES and EN', () => {
  for (const lang of ['es', 'en']) {
    const S = STR[lang];
    for (const e of ENTITIES) {
      const E = S.ent[e.key];
      for (const f of ['name', 'what', 'params', 'sees', 'tto']) assert.ok(E[f], `${lang} ${e.key}.${f}`);
      for (const st of e.steps) assert.ok(E.steps[st], `${lang} step ${e.key}.${st}`);
      for (const p of e.params) {
        assert.ok(S.params[p.key], `${lang} param ${p.key}`);
        if (p.type === 'choice') for (const o of p.options) assert.ok(S.choice[p.key][o], `${lang} choice ${p.key}.${o}`);
      }
      for (const g of [...e.tiles, ...e.charts]) assert.ok(S.gauges[g], `${lang} gauge ${g}`);
      assert.ok(S.units[e.unit]);
      for (const tr of [false, true]) {
        const r = simulate(e.key, defaults(e.key), tr);
        for (const ev of r.events) assert.equal(typeof S.ev[ev.key], 'function', `${lang} event ${ev.key}`);
        for (const pt of r.points) if (pt.badge) assert.ok(S.badge[pt.badge], `${lang} badge ${pt.badge}`);
      }
    }
    for (const k of Object.keys(PRESETS)) assert.ok(S.presets[k], `${lang} preset ${k}`);
  }
});

/* ---------- presets ---------- */
test('presets reference valid entities and parameters', () => {
  for (const [k, pr] of Object.entries(PRESETS)) {
    const e = ENTITIES.find(x => x.key === pr.entity);
    assert.ok(e, k);
    for (const pk of Object.keys(pr.params)) assert.ok(e.params.some(p => p.key === pk), `${k}.${pk}`);
    for (const ev of [...simulate(pr.entity, pr.params, false).events, ...simulate(pr.entity, pr.params, true).events]) {
      assert.equal(typeof STR.es.ev[ev.key], 'function', `${k} event ${ev.key}`);
    }
  }
});

/* ---------- mechanisms ---------- */
test('nephrosclerosis: higher BP → faster GFR loss; treatment slows it; target < 120 harms', () => {
  const lo = last(simulate('nefroangio', { pas: 145 })).g.fg;
  const hi = last(simulate('nefroangio', { pas: 190 })).g.fg;
  assert.ok(hi < lo);
  const P = PRESETS.hta_mal_controlada.params;
  assert.ok(last(simulate('nefroangio', P, true)).g.fg > last(simulate('nefroangio', P, false)).g.fg + 30);
  assert.ok(last(simulate('nefroangio', { ...P, objetivo: 112 }, true)).g.fg < last(simulate('nefroangio', { ...P, objetivo: 130 }, true)).g.fg);
});

test('malignant HTA: TAD ≥ 130 → hypoK, renin ↑, haemolysis; badge depends on fundus', () => {
  const r = simulate('hta_maligna', PRESETS.hta_maligna_papila.params);
  assert.ok(min(r, 'k') < 3.5 && max(r, 'renina') > 2 && max(r, 'ldh') > 300);
  assert.equal(last(r).badge, 'maligna');
  assert.equal(last(simulate('hta_maligna', PRESETS.hta_acelerada.params)).badge, 'acelerada');
  assert.equal(last(simulate('hta_maligna', { tad: 120 })).badge, null);
  assert.ok(last(simulate('hta_maligna', PRESETS.hta_maligna_papila.params, true)).g.fg > last(r).g.fg + 30);
});

test('ischaemic nephropathy: ACEi drops GFR only in bilateral stenosis; revascularisation needs > 70 %', () => {
  const bil = simulate('isquemica', PRESETS.estenosis_bilateral_ieca.params, true);
  assert.ok(evs(bil).includes('cr_ieca'));
  assert.ok(at(bil, 0.75).g.fg < at(bil, 0.25).g.fg * 0.85);
  const uni = simulate('isquemica', { ...PRESETS.estenosis_bilateral_ieca.params, lado: 'unilateral' }, true);
  assert.ok(!evs(uni).includes('cr_ieca'));
  assert.ok(evs(simulate('isquemica', { estenosis: 85, tto: 'revasc' }, true)).includes('revasc_ok'));
  assert.ok(evs(simulate('isquemica', { estenosis: 62, tto: 'revasc' }, true)).includes('revasc_no'));
  assert.equal(last(simulate('isquemica', { estenosis: 80 })).badge, 'significativa');
});

test('fibromuscular dysplasia: hypoK untreated; angioplasty normalises BP; bilateral ACEi → hypotension', () => {
  const u = simulate('fibrodisplasia', PRESETS.fmd_joven.params, false);
  assert.ok(min(u, 'k') < 3.6 && last(u).g.pas > 150);
  assert.ok(last(simulate('fibrodisplasia', PRESETS.fmd_joven.params, true)).g.pas < 130);
  const b = simulate('fibrodisplasia', PRESETS.fmd_bilateral_ieca.params, true);
  assert.ok(evs(b).includes('hipotension') && last(b).g.pas < 110);
  assert.equal(last(u).badge, 'joven');
});

test('renal infarct: thrombolysis inside the window salvages tissue; single kidney → anuria', () => {
  const early = last(simulate('infarto', PRESETS.infarto_precoz.params, true));
  const late = last(simulate('infarto', PRESETS.infarto_tardio.params, true));
  assert.ok(early.g.fg > 90 && late.g.fg < 55 && early.g.ldh < late.g.ldh);
  const mono = simulate('infarto', PRESETS.infarto_monorreno.params, false);
  assert.ok(last(mono).g.fg < 10 && last(mono).badge === 'anuria');
  const seg = last(simulate('infarto', { arteria: 'segmentaria', hora: 20 }, true));
  assert.ok(seg.g.necrosis < 50, 'segmental window is 24 h');
});

test('atheroembolism: GFR falls over weeks with transient eosinophilia and low C3', () => {
  const r = simulate('ateroembolia', PRESETS.ateroembolia_cateterismo.params);
  assert.ok(max(r, 'eos') > 500 && last(r).g.eos < 300 && min(r, 'c3') < 90);
  assert.ok(last(r).g.fg < r.points[0].g.fg * 0.65);
});

test('typical HUS: platelets and GFR dip then recover', () => {
  const r = simulate('shu_tipico', PRESETS.shu_diarrea.params);
  assert.ok(min(r, 'plaq') < 150 && last(r).g.plaq > 200);
  assert.ok(min(r, 'fg') < 40 && last(r).g.fg > 80);
  assert.ok(min(simulate('shu_tipico', PRESETS.shu_diarrea.params, true), 'hb') >= 8);
});

test('atypical HUS: eculizumab normalises platelets; earlier is better for GFR', () => {
  const early = simulate('shu_atipico', PRESETS.shu_atipico_precoz.params, true);
  const late = simulate('shu_atipico', PRESETS.shu_atipico_tardio.params, true);
  const none = simulate('shu_atipico', PRESETS.shu_atipico_precoz.params, false);
  assert.ok(at(early, 5).g.plaq > 150);
  assert.ok(last(early).g.fg > last(late).g.fg && last(late).g.fg > last(none).g.fg);
});

test('TTP: ADAMTS13 < 10 % → severe thrombocytopenia and neuro involvement; plasma exchange reverses it', () => {
  const u = simulate('ptt', PRESETS.ptt_grave.params, false);
  assert.ok(min(u, 'plaq') < 50 && max(u, 'neuro') > 1.5);
  const t = simulate('ptt', PRESETS.ptt_grave.params, true);
  assert.ok(last(t).g.plaq > 150 && last(t).g.neuro < 0.3);
  assert.equal(last(simulate('ptt', { adamts: 25 })).badge, null);
});

test('vasculitis: small-vessel RPGN destroys GFR untreated; PAN causes stepwise infarcts', () => {
  const u = simulate('vasculitis', PRESETS.vasculitis_anca.params, false);
  assert.ok(last(u).g.fg < 15);
  const e2 = last(simulate('vasculitis', { ...PRESETS.vasculitis_anca.params, semana: 2 }, true)).g.fg;
  const e6 = last(simulate('vasculitis', { ...PRESETS.vasculitis_anca.params, semana: 6 }, true)).g.fg;
  assert.ok(e2 > e6);
  const pan = simulate('vasculitis', PRESETS.pan.params, false);
  assert.ok(evs(pan).filter(k => k.startsWith('infarto')).length >= 3 && last(pan).g.pas > 150);
});
