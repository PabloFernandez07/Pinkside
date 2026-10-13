/* Demo de dashboard multivista. TODOS los datos son de EJEMPLO. El envío de MD por Discord está simulado. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + new Intl.NumberFormat('es-ES', { useGrouping: 'always' }).format(Math.round(n));
const signed = (n) => (n < 0 ? '−' : '+') + money(Math.abs(n));
const short = (n) => (Math.abs(n) >= 1000 ? Math.round(n / 1000) + 'k' : String(Math.round(n)));

/* ---------- datos de ejemplo ---------- */
const RANGOS = ['Líder', 'Lugarteniente', 'Miembro', 'Recluta'];
const MIEMBROS = [
  { id: 1, n: 'Carlos Vega', discord: 'cvega', rango: 'Lugarteniente', state: 48213, tel: '555-0142', cuota: true },
  { id: 2, n: 'Lucía Romero', discord: 'lromero', rango: 'Líder', state: 10477, tel: '555-0188', cuota: true },
  { id: 3, n: 'Dani Ortiz', discord: 'dortiz', rango: 'Miembro', state: 63320, tel: '555-0107', cuota: true },
  { id: 4, n: 'Marta Ibáñez', discord: 'mibanez', rango: 'Miembro', state: 57781, tel: '555-0165', cuota: false },
  { id: 5, n: 'Iván Soto', discord: 'isoto', rango: 'Recluta', state: 71940, tel: '555-0123', cuota: false },
];
const YO = MIEMBROS[0];
const quien = (id) => (MIEMBROS.find((m) => m.id === id) || { n: '—' }).n;
const SALDO_INICIAL = 40000;
const HOY = new Date(2026, 9, 12);
const MOVS = [
  { d: 0, m: 2, t: 'Venta de materiales', v: 42500 },
  { d: 0, m: 1, t: 'Compra de munición', v: -18000 },
  { d: 1, m: 3, t: 'Cuota semanal', v: 5000 },
  { d: 1, m: 4, t: 'Reparación de vehículo', v: -9750 },
  { d: 2, m: 1, t: 'Cuota semanal', v: 5000 },
  { d: 2, m: 5, t: 'Botín de operación', v: 120000 },
  { d: 3, m: 2, t: 'Material de crafteo', v: -26300 },
  { d: 5, m: 3, t: 'Venta de cargadores', v: 18400 },
  { d: 6, m: 4, t: 'Cuota semanal', v: 5000 },
  { d: 8, m: 2, t: 'Compra de acero', v: -14200 },
  { d: 9, m: 5, t: 'Venta de ganzúas', v: 9600 },
  { d: 11, m: 1, t: 'Gasolina y mecánico', v: -6100 },
  { d: 12, m: 3, t: 'Cuota semanal', v: 5000 },
  { d: 13, m: 2, t: 'Venta de materiales', v: 31000 },
];
const STOCK = [
  { n: 'Acero', q: 84, min: 40 }, { n: 'Pólvora', q: 12, min: 30 }, { n: 'Plástico', q: 57, min: 20 },
  { n: 'Tela', q: 9, min: 25 }, { n: 'Alcohol', q: 14, min: 10 }, { n: 'Ganzúas', q: 21, min: 10 },
  { n: 'Munición 9 mm', q: 240, min: 100 }, { n: 'Vendas', q: 3, min: 15 },
];
const RECETAS = [
  { n: 'Cargador 9 mm', precio: 1800, mats: [['Acero', 4, 120], ['Pólvora', 2, 310], ['Plástico', 1, 60]] },
  { n: 'Kit de ganzúas', precio: 2600, mats: [['Acero', 2, 120], ['Plástico', 2, 60]] },
  { n: 'Venda reforzada', precio: 900, mats: [['Tela', 3, 40], ['Alcohol', 1, 75]] },
];
const URGS = [
  { item: 'Pólvora', qty: 20, prio: 'Crítica', by: 2, estado: 'Abierto', t: 'hace 1 h' },
  { item: 'Vendas', qty: 15, prio: 'Alta', by: 1, estado: 'Abierto', t: 'ayer' },
];
const ACT = [
  { t: 'hace 4 min', who: 'Lucía Romero', txt: 'registró una entrada de $42.500 · Venta de materiales' },
  { t: 'hace 22 min', who: 'Carlos Vega', txt: 'registró una salida de $18.000 · Compra de munición' },
  { t: 'hace 1 h', who: 'Lucía Romero', txt: 'abrió un pedido urgente de 20× Pólvora y avisó por Discord' },
  { t: 'hace 3 h', who: 'Dani Ortiz', txt: 'fabricó 12× Cargador 9 mm' },
  { t: 'ayer', who: 'Iván Soto', txt: 'se unió a la banda · pendiente de aprobación' },
  { t: 'ayer', who: 'Carlos Vega', txt: 'abrió un pedido urgente de 15× Vendas' },
];
const PERMS = {
  'Ver caja': [1, 1, 1, 1], 'Registrar movimientos': [1, 1, 1, 0], 'Retirar dinero': [1, 1, 0, 0],
  'Editar inventario': [1, 1, 1, 0], 'Editar recetas': [1, 1, 0, 0], 'Enviar avisos urgentes': [1, 1, 1, 0], 'Gestionar miembros': [1, 0, 0, 0],
};
let recSel = 0;

/* ---------- cálculos ---------- */
const saldoActual = () => SALDO_INICIAL + MOVS.reduce((a, x) => a + x.v, 0);
const suma = (f) => MOVS.filter(f).reduce((a, x) => a + x.v, 0);
const fecha = (d) => { const x = new Date(HOY); x.setDate(x.getDate() - d); return x.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', ''); };
const serie = () => { const o = []; let s = SALDO_INICIAL; for (let d = 13; d >= 0; d--) { s += suma((x) => x.d === d); o.push(s); } return o; };
const cubos = () => Array.from({ length: 7 }, (_, b) => {
  const f = (x) => x.d >= (6 - b) * 2 && x.d < (7 - b) * 2;
  return { l: fecha((7 - b) * 2 - 1), i: suma((x) => f(x) && x.v > 0), o: -suma((x) => f(x) && x.v < 0) };
});
const stockBajo = () => STOCK.filter((s) => s.q < s.min);
const urgAbiertas = () => URGS.filter((u) => u.estado === 'Abierto');
const stockDe = (n) => (STOCK.find((s) => s.n === n) || { q: 0 }).q;
const calcReceta = (r, q) => {
  let coste = 0, max = Infinity; const filas = [];
  r.mats.forEach(([n, c, p]) => {
    const need = c * q, have = stockDe(n); coste += need * p; max = Math.min(max, Math.floor(have / c));
    filas.push({ n, need, have, falta: Math.max(0, need - have) });
  });
  return { filas, coste, ing: r.precio * q, max };
};

/* ---------- gráficos SVG (se dibujan al tamaño real del contenedor) ---------- */
const OBS = [];
function fit(el, draw) {
  const go = () => { const r = el.getBoundingClientRect(); if (r.width > 20 && r.height > 20) el.innerHTML = draw(Math.floor(r.width), Math.floor(r.height)); };
  go(); const o = new ResizeObserver(go); o.observe(el); OBS.push(o);
}
const P = { l: 44, r: 10, t: 10, b: 24 };
function grid(w, h, lo, hi) {
  let s = '';
  for (let k = 0; k <= 3; k++) {
    const v = lo + ((hi - lo) * k) / 3, y = P.t + (h - P.t - P.b) * (1 - k / 3);
    s += `<line class="ch-grid" x1="${P.l}" x2="${w - P.r}" y1="${y}" y2="${y}"/><text class="ch-lab" x="${P.l - 8}" y="${y + 4}" text-anchor="end">${short(v)}</text>`;
  }
  return s;
}
function drawLine(w, h) {
  const S = serie(), lo = Math.floor(Math.min(...S) / 20000) * 20000, hi = lo + 3 * Math.ceil((Math.max(...S) - lo) / 3 / 20000) * 20000;
  const x = (i) => P.l + ((w - P.l - P.r) * i) / (S.length - 1), y = (v) => P.t + (h - P.t - P.b) * (1 - (v - lo) / (hi - lo));
  const d = S.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const base = h - P.b, last = S.length - 1;
  return `<svg width="${w}" height="${h}" role="img" aria-label="Evolución del saldo de la caja en 14 días">${grid(w, h, lo, hi)}
  <path class="ch-area" d="${d}L${x(last)},${base}L${x(0)},${base}Z"/><path class="ch-line" d="${d}"/>
  <circle class="ch-dot" cx="${x(last)}" cy="${y(S[last])}" r="4"/>
  <text class="ch-lab" x="${P.l}" y="${h - 6}">${fecha(13)}</text><text class="ch-lab" x="${x(6.5)}" y="${h - 6}" text-anchor="middle">${fecha(6)}</text><text class="ch-lab" x="${w - P.r}" y="${h - 6}" text-anchor="end">hoy</text></svg>`;
}
function drawBars(w, h) {
  const B = cubos(), hi = 3 * Math.ceil(Math.max(...B.flatMap((b) => [b.i, b.o])) / 3 / 20000) * 20000, lo = 0;
  const slot = (w - P.l - P.r) / B.length, bw = Math.min(26, slot * 0.3), y = (v) => P.t + (h - P.t - P.b) * (1 - v / hi);
  const bars = B.map((b, i) => {
    const cx = P.l + slot * (i + 0.5), base = h - P.b;
    return `<rect class="ch-in" x="${cx - bw - 1}" y="${y(b.i)}" width="${bw}" height="${base - y(b.i)}" rx="2"/><rect class="ch-out" x="${cx + 1}" y="${y(b.o)}" width="${bw}" height="${base - y(b.o)}" rx="2"/><text class="ch-lab" x="${cx}" y="${h - 6}" text-anchor="middle">${b.l}</text>`;
  }).join('');
  return `<svg width="${w}" height="${h}" role="img" aria-label="Ingresos y gastos de la caja por tramos de dos días">${grid(w, h, lo, hi)}${bars}</svg>`;
}
const spark = (S) => {
  const lo = Math.min(...S), hi = Math.max(...S);
  const d = S.map((v, i) => `${i ? 'L' : 'M'}${(i / (S.length - 1)) * 100},${26 - ((v - lo) / (hi - lo || 1)) * 24}`).join('');
  return `<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path class="ch-line" d="${d}" vector-effect="non-scaling-stroke"/></svg>`;
};

/* ---------- piezas de UI ---------- */
const ICON = {
  resumen: '<path d="M3 12l9-8 9 8M5 10v10h14V10"/>',
  caja: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/>',
  inventario: '<path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10"/>',
  recetas: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  urgentes: '<path d="M12 3l10 18H2L12 3zM12 10v5M12 18h.01"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  admin: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
};
const NAV = [['resumen', 'Resumen'], ['caja', 'Caja'], ['inventario', 'Inventario'], ['recetas', 'Recetas'], ['urgentes', 'Urgentes'], ['perfil', 'Mi perfil'], ['admin', 'Administración']];
const kpi = (l, v, extra = '', cls = '') => `<article class="kpi ${cls}"><span class="l">${l}</span><strong class="v">${v}</strong><span class="s">${extra}</span></article>`;
const initials = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2);
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
}
const nivel = (s) => Math.min(100, Math.round((s.q / (s.min * 2)) * 100));

/* ---------- vistas ---------- */
function alertasHTML() {
  const bajo = stockBajo(), sinCuota = MIEMBROS.filter((m) => !m.cuota);
  const bloq = RECETAS.filter((r) => calcReceta(r, 10).max < 10);
  return `<div class="alerts">
    <h3>Stock bajo mínimo <b>${bajo.length}</b></h3>
    <ul>${bajo.map((s) => `<li><span>${esc(s.n)} <small>${s.q}/${s.min}</small></span><button class="btn sm" data-pedir="${esc(s.n)}" data-qty="${s.min * 2 - s.q}">Pedir</button></li>`).join('')}</ul>
    <h3>Cuotas pendientes <b>${sinCuota.length}</b></h3>
    <ul>${sinCuota.map((m) => `<li><span>${esc(m.n)}</span><small>${esc(m.rango)}</small></li>`).join('')}</ul>
    <h3>Recetas sin material para 10 uds. <b>${bloq.length}</b></h3>
    <ul>${bloq.map((r) => `<li><span>${esc(r.n)}</span><small>faltan ${calcReceta(r, 10).filas.filter((f) => f.falta).map((f) => esc(f.n)).join(', ')}</small></li>`).join('')}</ul>
  </div>`;
}
const feedHTML = () => `<ul class="feed">${ACT.map((a) => `<li><i aria-hidden="true"></i><div><b>${esc(a.who)}</b> ${esc(a.txt)}<time>${esc(a.t)}</time></div></li>`).join('')}</ul>`;
const bindPedir = (el) => $$('[data-pedir]', el).forEach((b) => (b.onclick = () => urgDialog({ item: b.dataset.pedir, qty: b.dataset.qty })));

function vResumen(el) {
  const e7 = suma((x) => x.d < 7 && x.v > 0), s7 = -suma((x) => x.d < 7 && x.v < 0), crit = urgAbiertas().filter((u) => u.prio === 'Crítica').length;
  el.innerHTML = `<div class="page">
  <div class="phead"><h1>Resumen</h1><p>Vista general de la banda</p></div>
  <div class="kpis">${kpi('Saldo de la caja', money(saldoActual()), spark(serie()), 'main')}${kpi('Entradas · 7 días', money(e7), 'dinero que ha entrado')}${kpi('Salidas · 7 días', money(s7), 'dinero que ha salido', 'neg')}${kpi('Stock en alerta', stockBajo().length, 'items bajo el mínimo')}${kpi('Pedidos urgentes', urgAbiertas().length, crit ? crit + ' crítico' + (crit > 1 ? 's' : '') : 'sin críticos', 'warn')}</div>
  <div class="grid g-resumen">
    <section class="card a-line"><header><h2>Evolución de la caja</h2><span class="hint">últimos 14 días</span></header><div class="chart" id="c1"></div></section>
    <section class="card a-alert"><header><h2>Alertas y pendientes</h2></header><div class="scroll">${alertasHTML()}</div></section>
    <section class="card a-bars"><header><h2>Ingresos y gastos</h2><span class="legend"><i class="k1"></i>Ingresos<i class="k2"></i>Gastos</span></header><div class="chart" id="c2"></div></section>
    <section class="card a-feed"><header><h2>Actividad</h2><span class="live">en vivo</span></header><div class="scroll">${feedHTML()}</div></section>
  </div></div>`;
  fit($('#c1', el), drawLine); fit($('#c2', el), drawBars); bindPedir(el);
}

function movTabla() {
  return `<table><thead><tr><th>Fecha</th><th>Miembro</th><th>Motivo</th><th class="num">Importe</th></tr></thead><tbody>${[...MOVS].sort((a, b) => a.d - b.d).map((x) => `<tr class="${x.v < 0 ? 'out' : 'in'}"><td class="mono">${fecha(x.d)}</td><td>${esc(quien(x.m))}</td><td>${esc(x.t)}</td><td class="num mono">${signed(x.v)}</td></tr>`).join('')}</tbody></table>`;
}
function vCaja(el) {
  const ent = suma((x) => x.v > 0), sal = -suma((x) => x.v < 0);
  const ap = MIEMBROS.map((m) => ({ n: m.n, v: MOVS.filter((x) => x.m === m.id && x.v > 0).reduce((a, x) => a + x.v, 0) })).sort((a, b) => b.v - a.v), mx = Math.max(...ap.map((a) => a.v), 1);
  el.innerHTML = `<div class="page">
  <div class="phead"><h1>Caja común</h1><p>Una sola caja con registro de todos los movimientos</p></div>
  <div class="kpis k3">${kpi('Saldo', money(saldoActual()), '', 'main')}${kpi('Entradas · 14 días', money(ent))}${kpi('Salidas · 14 días', money(sal), '', 'neg')}</div>
  <div class="grid g-caja">
    <section class="card a-movs"><header><h2>Movimientos</h2><span class="hint">${MOVS.length} registros</span></header><div class="scroll">${movTabla()}</div></section>
    <div class="stack">
      <section class="card"><header><h2>Registrar movimiento</h2></header><form id="fmov" class="form">
        <label>Tipo<select name="tipo"><option value="1">Entrada</option><option value="-1">Salida</option></select></label>
        <label>Importe<input name="imp" type="number" min="1" required placeholder="0"></label>
        <label class="wide">Motivo<input name="mot" type="text" required maxlength="60" placeholder="Venta, compra, cuota…"></label>
        <button class="btn wide" type="submit">Registrar</button></form></section>
      <section class="card grow"><header><h2>Aportes por miembro</h2></header><div class="scroll"><ul class="hbars">${ap.map((a) => `<li><span>${esc(a.n)}</span><b class="mono">${money(a.v)}</b><i style="--w:${Math.round((a.v / mx) * 100)}%"></i></li>`).join('')}</ul></div></section>
    </div></div></div>`;
  $('#fmov', el).onsubmit = (e) => {
    e.preventDefault(); const f = e.target, imp = Math.abs(parseInt(f.imp.value, 10)) || 0; if (!imp) return;
    MOVS.push({ d: 0, m: YO.id, t: f.mot.value.trim(), v: imp * parseInt(f.tipo.value, 10) });
    ACT.unshift({ t: 'ahora', who: YO.n, txt: `registró ${f.tipo.value === '1' ? 'una entrada' : 'una salida'} de ${money(imp)} · ${f.mot.value.trim()}` });
    toast('Movimiento registrado'); go();
  };
}

function vInv(el) {
  el.innerHTML = `<div class="page">
  <div class="phead"><h1>Inventario</h1><p>Stock compartido de la banda</p><input id="q" class="search-in" type="search" placeholder="Buscar item…" aria-label="Buscar item"></div>
  <div class="grid one"><section class="card"><div class="scroll"><table id="tinv"></table></div></section></div></div>`;
  const pintar = (f = '') => {
    $('#tinv', el).innerHTML = `<thead><tr><th>Item</th><th class="num">Stock</th><th class="num">Mínimo</th><th>Nivel</th><th>Estado</th><th></th></tr></thead><tbody>${STOCK.filter((s) => s.n.toLowerCase().includes(f.toLowerCase())).map((s) => {
      const low = s.q < s.min;
      return `<tr class="${low ? 'low' : ''}"><td>${esc(s.n)}</td><td class="num mono">${s.q}</td><td class="num mono">${s.min}</td><td><span class="bar"><i style="width:${nivel(s)}%"></i></span></td><td><span class="chip ${low ? 'bad' : 'ok'}">${low ? 'Bajo mínimo' : 'Correcto'}</span></td><td class="num">${low ? `<button class="btn sm" data-pedir="${esc(s.n)}" data-qty="${s.min * 2 - s.q}">Pedir urgente</button>` : ''}</td></tr>`;
    }).join('')}</tbody>`; bindPedir(el);
  };
  pintar(); $('#q', el).oninput = (e) => pintar(e.target.value);
}

function vRec(el) {
  const r = RECETAS[recSel], q0 = 10;
  el.innerHTML = `<div class="page">
  <div class="phead"><h1>Recetas</h1><p>Calcula materiales, coste y beneficio antes de fabricar</p></div>
  <div class="grid g-rec">
    <section class="card"><header><h2>Catálogo</h2></header><div class="scroll"><ul class="list">${RECETAS.map((x, i) => {
      const c = x.mats.reduce((a, [, n, p]) => a + n * p, 0);
      return `<li><button class="item ${i === recSel ? 'on' : ''}" data-r="${i}"><b>${esc(x.n)}</b><span class="mono">margen ${money(x.precio - c)} / ud.</span></button></li>`;
    }).join('')}</ul></div></section>
    <section class="card"><header><h2>${esc(r.n)}</h2><label class="inl">Unidades<input id="qty" type="number" min="1" value="${q0}"></label></header><div class="scroll"><table id="tmat"></table><dl class="res" id="res"></dl></div><footer id="rfoot"></footer></section>
  </div></div>`;
  const calc = () => {
    const q = Math.max(1, parseInt($('#qty', el).value, 10) || 1), c = calcReceta(r, q), falta = c.filas.filter((f) => f.falta);
    $('#tmat', el).innerHTML = `<thead><tr><th>Material</th><th class="num">Necesario</th><th class="num">En stock</th><th class="num">Falta</th></tr></thead><tbody>${c.filas.map((f) => `<tr class="${f.falta ? 'low' : ''}"><td>${esc(f.n)}</td><td class="num mono">${f.need}</td><td class="num mono">${f.have}</td><td class="num mono">${f.falta || '—'}</td></tr>`).join('')}</tbody>`;
    $('#res', el).innerHTML = `<div><dt>Coste de materiales</dt><dd class="mono">${money(c.coste)}</dd></div><div><dt>Ingreso por venta</dt><dd class="mono">${money(c.ing)}</dd></div><div class="hl"><dt>Beneficio</dt><dd class="mono">${money(c.ing - c.coste)}</dd></div><div><dt>Fabricables con el stock actual</dt><dd class="mono">${c.max}</dd></div>`;
    $('#rfoot', el).innerHTML = falta.length ? `<span>Faltan ${falta.map((f) => `${f.falta}× ${esc(f.n)}`).join(', ')}</span><button class="btn" id="bfalta">Pedir lo que falta por Discord</button>` : '<span>Hay material de sobra para esta tanda.</span>';
    if (falta.length) $('#bfalta', el).onclick = () => urgDialog({ item: falta.map((f) => f.n).join(' + '), qty: falta.map((f) => f.falta).join(' + ') });
  };
  $('#qty', el).oninput = calc; calc();
  $$('[data-r]', el).forEach((b) => (b.onclick = () => { recSel = +b.dataset.r; go(); }));
}

function vUrg(el) {
  el.innerHTML = `<div class="page">
  <div class="phead"><h1>Pedidos urgentes</h1><p>Lo que la banda necesita ya, con aviso por MD de Discord</p><button class="btn" id="nuevo">Nuevo pedido urgente</button></div>
  <div class="grid one"><section class="card"><div class="scroll"><table><thead><tr><th>Item</th><th class="num">Cantidad</th><th>Prioridad</th><th>Pedido por</th><th>Cuándo</th><th>Estado</th><th></th></tr></thead><tbody>${URGS.map((u, i) => `<tr class="${u.estado === 'Abierto' ? '' : 'done'}"><td>${esc(u.item)}</td><td class="num mono">${esc(u.qty)}</td><td><span class="chip ${u.prio === 'Crítica' ? 'bad' : 'warn'}">${esc(u.prio)}</span></td><td>${esc(quien(u.by))}</td><td class="mono">${esc(u.t)}</td><td>${esc(u.estado)}</td><td class="num">${u.estado === 'Abierto' ? `<button class="btn sm ghost" data-ok="${i}">Marcar cubierto</button>` : ''}</td></tr>`).join('')}</tbody></table></div></section></div></div>`;
  $('#nuevo', el).onclick = () => urgDialog({});
  $$('[data-ok]', el).forEach((b) => (b.onclick = () => { URGS[+b.dataset.ok].estado = 'Cubierto'; toast('Pedido marcado como cubierto'); go(); }));
}

function vPerfil(el) {
  el.innerHTML = `<div class="page">
  <div class="phead"><h1>Mi perfil</h1><p>Datos que pediste en tu primer inicio de sesión</p></div>
  <div class="grid g-perfil">
    <section class="card"><header><h2>Datos personales</h2></header><form class="form" id="fper">
      <div class="who wide"><span class="avatar big">${initials(YO.n)}</span><div><b>${esc(YO.n)}</b><small>${esc(YO.rango)} · Discord @${esc(YO.discord)}</small></div><button class="btn ghost sm" type="button" id="foto">Cambiar foto</button></div>
      <label>StateID<input value="${YO.state}" inputmode="numeric"></label><label>Teléfono<input value="${esc(YO.tel)}"></label>
      <label>Nombre<input value="Carlos"></label><label>Apellidos<input value="Vega Ruiz"></label>
      <button class="btn wide" type="submit">Guardar cambios</button></form></section>
    <section class="card"><header><h2>Preferencias</h2></header><div class="form">
      <div class="row wide"><span><b>Tema</b><small>Claro u oscuro, se recuerda en este navegador</small></span><button class="btn ghost sm" type="button" data-tema>Cambiar tema</button></div>
      <div class="row wide"><span><b>Avisos urgentes por MD</b><small>Recibir mensaje privado de Discord cuando haya un pedido</small></span><input type="checkbox" class="sw" checked aria-label="Avisos urgentes por MD"></div>
      <div class="row wide"><span><b>Cuenta de Discord</b><small>Vinculada · @${esc(YO.discord)}</small></span><span class="chip ok">Vinculada</span></div></div></section>
  </div></div>`;
  $('#fper', el).onsubmit = (e) => { e.preventDefault(); toast('Perfil guardado (demo)'); };
  $('#foto', el).onclick = () => toast('Aquí se subiría la foto (demo)');
  bindTema(el);
}

function vAdmin(el) {
  el.innerHTML = `<div class="page">
  <div class="phead"><h1>Administración</h1><p>Rangos y permisos configurables desde aquí</p></div>
  <div class="grid g-admin">
    <section class="card"><header><h2>Permisos por rango</h2></header><div class="scroll"><table><thead><tr><th>Permiso</th>${RANGOS.map((r) => `<th class="ctr">${r}</th>`).join('')}</tr></thead><tbody>${Object.entries(PERMS).map(([p, v]) => `<tr><td>${p}</td>${v.map((on, i) => `<td class="ctr"><input type="checkbox" class="chk" ${on ? 'checked' : ''} aria-label="${esc(p)} para ${RANGOS[i]}"></td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
    <section class="card"><header><h2>Miembros</h2><span class="hint">acceso por ID de Discord</span></header><div class="scroll"><table><thead><tr><th>Miembro</th><th>Discord</th><th>Rango</th><th>Estado</th></tr></thead><tbody>${MIEMBROS.map((m) => `<tr><td>${esc(m.n)}</td><td class="mono">@${esc(m.discord)}</td><td><select aria-label="Rango de ${esc(m.n)}">${RANGOS.map((r) => `<option ${r === m.rango ? 'selected' : ''}>${r}</option>`).join('')}</select></td><td>${m.rango === 'Recluta' ? '<button class="btn sm" data-apr>Aprobar acceso</button>' : '<span class="chip ok">Activo</span>'}</td></tr>`).join('')}</tbody></table></div></section>
  </div></div>`;
  $$('[data-apr]', el).forEach((b) => (b.onclick = () => { b.replaceWith(Object.assign(document.createElement('span'), { className: 'chip ok', textContent: 'Activo' })); toast('Acceso aprobado (demo)'); }));
}

/* ---------- aviso urgente por Discord (simulado) ---------- */
function urgDialog(pre) {
  let d = $('#dlg'); if (d) d.remove();
  d = document.createElement('dialog'); d.id = 'dlg';
  d.innerHTML = `<form method="dialog" class="form dlg">
    <h2>Pedido urgente</h2>
    <label class="wide">Qué se necesita<input name="item" required maxlength="80" value="${esc(pre.item || '')}" placeholder="Material, item, dinero…"></label>
    <label>Cantidad<input name="qty" required maxlength="30" value="${esc(pre.qty || '')}" placeholder="20"></label>
    <label>Prioridad<select name="prio"><option>Alta</option><option>Crítica</option></select></label>
    <fieldset class="wide"><legend>Avisar por MD de Discord a</legend>
      ${MIEMBROS.filter((m) => m.id !== YO.id).map((m) => `<label class="chk-row"><input type="checkbox" name="to" value="${m.id}" checked> ${esc(m.n)} <small>@${esc(m.discord)} · ${esc(m.rango)}</small></label>`).join('')}</fieldset>
    <div class="wide"><small class="muted">Vista previa del mensaje privado</small><div class="dm" id="dm"></div></div>
    <menu class="wide"><button class="btn ghost" value="cancel" formnovalidate>Cancelar</button><button class="btn" id="send" value="ok">Enviar MD por Discord</button></menu></form>`;
  document.body.appendChild(d);
  const f = $('form', d), prev = () => { $('#dm', d).innerHTML = `<b>Banda Bot</b><span>URGENTE · ${esc(f.prio.value)}</span><p>${esc(YO.n)} necesita <b>${esc(f.qty.value || '—')}× ${esc(f.item.value || '…')}</b>. Llévalo al almacén o responde aquí.</p>`; };
  f.oninput = prev; prev();
  f.onsubmit = (e) => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    const to = $$('[name=to]:checked', f).length;
    if (!f.item.value.trim() || !f.qty.value.trim() || !to) { e.preventDefault(); toast(to ? 'Rellena item y cantidad' : 'Elige al menos un destinatario'); return; }
    URGS.unshift({ item: f.item.value.trim(), qty: f.qty.value.trim(), prio: f.prio.value, by: YO.id, estado: 'Abierto', t: 'ahora' });
    ACT.unshift({ t: 'ahora', who: YO.n, txt: `abrió un pedido urgente de ${f.qty.value.trim()}× ${f.item.value.trim()} y avisó por Discord a ${to} miembro${to > 1 ? 's' : ''}` });
    toast(`MD enviado a ${to} miembro${to > 1 ? 's' : ''} (simulado)`); setTimeout(go, 0);
  };
  d.addEventListener('close', () => d.remove()); d.showModal();
}

/* ---------- tema y router ---------- */
function bindTema(root = document) {
  $$('[data-tema]', root).forEach((b) => (b.onclick = () => {
    const r = document.documentElement, n = r.dataset.theme === 'dark' ? 'light' : 'dark'; r.dataset.theme = n;
    try { localStorage.setItem('tema-dash', n); } catch (e) { /* sin almacenamiento */ }
  }));
}
const ROUTES = { resumen: ['Resumen', vResumen], caja: ['Caja', vCaja], inventario: ['Inventario', vInv], recetas: ['Recetas', vRec], urgentes: ['Urgentes', vUrg], perfil: ['Mi perfil', vPerfil], admin: ['Administración', vAdmin] };
function go() {
  const k = ROUTES[location.hash.replace('#/', '')] ? location.hash.replace('#/', '') : 'resumen';
  OBS.forEach((o) => o.disconnect()); OBS.length = 0;
  const nav = $('#nav');
  nav.innerHTML = NAV.map(([id, l]) => `<a href="#/${id}" data-v="${id}" title="${l}"${id === k ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id]}</svg><span>${l}</span>${id === 'urgentes' && urgAbiertas().length ? `<b class="badge">${urgAbiertas().length}</b>` : ''}</a>`).join('');
  const c = $('#crumb'); if (c) c.textContent = ROUTES[k][0];
  const view = $('#view'); view.innerHTML = ''; ROUTES[k][1](view); view.scrollTop = 0;
  document.title = ROUTES[k][0] + ' · ' + document.title.split(' · ').pop();
}
(function init() {
  try { const t = localStorage.getItem('tema-dash'); if (t) document.documentElement.dataset.theme = t; } catch (e) { /* sin almacenamiento */ }
  bindTema(); addEventListener('hashchange', go); go();
})();
