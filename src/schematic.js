// Schematic: aorta → renal artery → segmental artery → arteriole → glomerular capillary.
// The site of the selected entity is highlighted; kidney colour follows GFR; lesion size follows severity.
export function drawSchematic(box, e, pt, tr) {
  const L = pt.lesion;
  const fg = pt.g.fg ?? 90;
  const health = Math.max(0, Math.min(1, fg / 100));
  const on = (loc) => e.loc === loc;
  const cls = (loc) => (on(loc) ? 'lbl-on' : '');
  const hot = 'var(--hot)';
  const vessel = (loc) => (on(loc) ? hot : 'var(--vessel)');
  const necro = pt.g.necrosis != null ? pt.g.necrosis / 100 : 0;
  const stenosis = (e.key === 'isquemica' || e.key === 'fibrodisplasia') ? 2 + 10 * (1 - L) : 12;
  const beads = e.key === 'fibrodisplasia';
  const pulse = L > 0.05 ? `<circle class="pulse" r="${10 + 16 * L}" fill="none" stroke="${hot}" stroke-width="2" opacity="${0.35 + 0.5 * L}"/>` : '';
  const site = { arteria: [180, 120], segmentaria: [318, 92], arteriola: [528, 98], capilar: [600, 148], glomerulo: [600, 148] }[e.loc];
  box.innerHTML = `
<svg viewBox="0 0 700 260" role="img" aria-label="${tr('schem.aria')}">
  <!-- aorta -->
  <rect x="40" y="10" width="34" height="222" rx="16" fill="var(--vessel)" opacity=".85"/>
  <text x="57" y="252" text-anchor="middle">${tr('schem.aorta')}</text>
  <!-- renal artery with stenosis -->
  <path d="M74 120 H150" stroke="${vessel('arteria')}" stroke-width="12" stroke-linecap="round"/>
  <path d="M150 120 H210" stroke="${vessel('arteria')}" stroke-width="${on('arteria') ? stenosis : 12}" stroke-linecap="round"/>
  ${beads && on('arteria') ? [160, 176, 192].map(x => `<circle cx="${x}" cy="120" r="7" fill="none" stroke="${hot}" stroke-width="2"/>`).join('') : ''}
  <path d="M210 120 H245" stroke="${vessel('arteria')}" stroke-width="12" stroke-linecap="round"/>
  <text x="165" y="100" text-anchor="middle" class="${cls('arteria')}">${tr('schem.arteria')}</text>
  <!-- kidney -->
  <path d="M250 40 C330 0 420 30 420 120 C420 210 330 240 250 200 C285 175 285 65 250 40 Z"
        fill="var(--tissue)" stroke="var(--tissue-line)" stroke-width="2" style="filter:saturate(${0.35 + 0.65 * health})"/>
  <path d="M250 40 C330 0 420 30 420 120 C420 210 330 240 250 200 C285 175 285 65 250 40 Z" fill="var(--page)" opacity="${0.55 * (1 - health)}"/>
  ${necro > 0 ? `<path d="M262 120 L405 60 A140 140 0 0 1 405 180 Z" fill="${hot}" opacity="${0.15 + 0.6 * necro}"/>` : ''}
  <!-- segmental branches -->
  <path d="M248 120 C280 120 300 92 340 80" stroke="${vessel('segmentaria')}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M248 120 C285 122 310 150 345 165" stroke="var(--vessel)" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M340 80 C365 72 380 64 400 66 M345 165 C370 172 385 176 402 172 M330 110 C360 112 380 118 404 120" stroke="var(--vessel)" stroke-width="3" fill="none"/>
  <text x="330" y="64" text-anchor="middle" class="${cls('segmentaria')}">${tr('schem.segmentaria')}</text>
  <text x="335" y="232" text-anchor="middle">${tr('schem.rinon')} · ${tr('schem.fg')} ${Math.round(fg)}</text>
  <!-- zoom inset -->
  <line x1="404" y1="120" x2="470" y2="120" stroke="var(--axis)" stroke-dasharray="3 3"/>
  <circle cx="575" cy="128" r="112" fill="var(--surface)" stroke="var(--axis)" stroke-dasharray="4 4"/>
  <path d="M470 100 H560" stroke="${vessel('arteriola')}" stroke-width="${on('arteriola') ? 8 - 5 * L : 8}" stroke-linecap="round"/>
  ${on('arteriola') && L > 0.1 ? `<path d="M480 100 H555" stroke="${hot}" stroke-width="${2 + 6 * L}" stroke-opacity=".35" stroke-linecap="round"/>` : ''}
  <text x="515" y="84" text-anchor="middle" class="${cls('arteriola')}">${tr('schem.arteriola')}</text>
  <circle cx="600" cy="148" r="42" fill="none" stroke="var(--tissue-line)" stroke-width="2"/>
  ${[0, 1, 2, 3, 4].map(i => `<path d="M${572 + i * 3} ${120 + i * 4} q ${18 + i * 2} ${22} ${48 - i * 4} ${20 - i}" stroke="${on('capilar') || on('glomerulo') ? hot : 'var(--vessel)'}" stroke-width="3" fill="none" opacity="${0.55 + 0.1 * i}"/>`).join('')}
  ${(on('capilar')) ? Array.from({ length: Math.round(2 + 10 * L) }, (_, i) => `<circle cx="${578 + (i * 13) % 44}" cy="${132 + (i * 7) % 30}" r="3" fill="${hot}"/>`).join('') : ''}
  ${(on('glomerulo')) && L > 0.3 ? `<path d="M562 160 A42 42 0 0 0 600 190" stroke="${hot}" stroke-width="${3 + 7 * L}" fill="none" opacity=".7"/>` : ''}
  <text x="600" y="214" text-anchor="middle" class="${cls('capilar') || cls('glomerulo')}">${tr('schem.glomerulo')}</text>
  <g transform="translate(${site[0]} ${site[1]})">${pulse}</g>
</svg>`;
}
