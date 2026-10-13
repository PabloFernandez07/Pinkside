/* Datos de EJEMPLO para las demos de estilo. No son datos reales de la banda. */
const MOVS = [
  { f: '11 oct', m: 'Carlos Vega', t: 'Venta de materiales', v: 42500 },
  { f: '11 oct', m: 'Lucía Romero', t: 'Compra de munición', v: -18000 },
  { f: '10 oct', m: 'Dani Ortiz', t: 'Cuota semanal', v: 5000 },
  { f: '10 oct', m: 'Marta Ibáñez', t: 'Reparación de vehículo', v: -9750 },
  { f: '09 oct', m: 'Carlos Vega', t: 'Cuota semanal', v: 5000 },
  { f: '09 oct', m: 'Iván Soto', t: 'Botín de operación', v: 120000 },
  { f: '08 oct', m: 'Lucía Romero', t: 'Material de crafteo', v: -26300 },
];
const STOCK = [
  { n: 'Acero', q: 84, min: 40 },
  { n: 'Pólvora', q: 12, min: 30 },
  { n: 'Plástico', q: 57, min: 20 },
  { n: 'Vendas', q: 3, min: 15 },
  { n: 'Ganzúas', q: 21, min: 10 },
  { n: 'Munición 9 mm', q: 240, min: 100 },
];
const RECETA = {
  n: 'Cargador 9 mm',
  precio: 1800,
  mats: [['Acero', 4, 120], ['Pólvora', 2, 310], ['Plástico', 1, 60]],
};

const fmt = (n) => new Intl.NumberFormat('es-ES', { useGrouping: 'always' }).format(n);
const money = (n) => '$' + fmt(n);
const $ = (s, r = document) => r.querySelector(s);

function renderSaldo() {
  const ent = MOVS.filter((x) => x.v > 0).reduce((a, x) => a + x.v, 0);
  const sal = MOVS.filter((x) => x.v < 0).reduce((a, x) => a + x.v, 0);
  document.querySelectorAll('[data-saldo]').forEach((e) => (e.textContent = money(ent + sal)));
  document.querySelectorAll('[data-entradas]').forEach((e) => (e.textContent = money(ent)));
  document.querySelectorAll('[data-salidas]').forEach((e) => (e.textContent = money(-sal)));
}

function renderMovs() {
  const el = $('#movs');
  if (!el) return;
  el.innerHTML =
    '<table class="mov"><thead><tr><th>Fecha</th><th>Miembro</th><th>Motivo</th><th class="num">Importe</th></tr></thead><tbody>' +
    MOVS.map(
      (x) =>
        `<tr class="${x.v < 0 ? 'out' : 'in'}"><td>${x.f}</td><td>${x.m}</td><td>${x.t}</td><td class="num">${x.v < 0 ? '−' : '+'}${money(Math.abs(x.v))}</td></tr>`
    ).join('') +
    '</tbody></table>';
}

function renderStock() {
  const el = $('#stock');
  if (!el) return;
  el.innerHTML =
    '<ul class="stock">' +
    STOCK.map((s) => {
      const pct = Math.min(100, Math.round((s.q / (s.min * 2)) * 100));
      const low = s.q < s.min;
      return `<li class="${low ? 'low' : ''}"><span class="n">${s.n}</span><span class="q">${s.q}<small>/${s.min}</small></span><span class="bar"><i style="width:${pct}%"></i></span>${low ? '<b class="tag">bajo</b>' : ''}</li>`;
    }).join('') +
    '</ul>';
}

function renderReceta() {
  const el = $('#receta');
  if (!el) return;
  el.innerHTML = `
    <div class="calc">
      <label class="qty">Unidades a fabricar
        <input id="qty" type="number" min="1" value="10" inputmode="numeric">
      </label>
      <table class="mat"><thead><tr><th>Material</th><th class="num">Necesario</th><th class="num">En stock</th><th class="num">Falta</th></tr></thead><tbody id="mats"></tbody></table>
      <dl class="res">
        <div><dt>Coste de materiales</dt><dd id="coste"></dd></div>
        <div><dt>Ingreso por venta</dt><dd id="ingreso"></dd></div>
        <div><dt>Beneficio</dt><dd id="benef"></dd></div>
        <div><dt>Con el stock actual</dt><dd id="max"></dd></div>
      </dl>
    </div>`;
  const calc = () => {
    const q = Math.max(1, parseInt($('#qty').value, 10) || 1);
    let coste = 0, max = Infinity;
    $('#mats').innerHTML = RECETA.mats
      .map(([n, c, p]) => {
        const need = c * q;
        const have = (STOCK.find((s) => s.n === n) || { q: 0 }).q;
        coste += need * p;
        max = Math.min(max, Math.floor(have / c));
        const miss = Math.max(0, need - have);
        return `<tr class="${miss ? 'short' : ''}"><td>${n}</td><td class="num">${need}</td><td class="num">${have}</td><td class="num">${miss || '—'}</td></tr>`;
      })
      .join('');
    const ing = RECETA.precio * q;
    $('#coste').textContent = money(coste);
    $('#ingreso').textContent = money(ing);
    $('#benef').textContent = money(ing - coste);
    $('#max').textContent = max + ' uds.';
  };
  $('#qty').addEventListener('input', calc);
  calc();
}

function initTema() {
  const root = document.documentElement;
  const btn = document.querySelector('[data-tema]');
  let saved = null;
  try { saved = localStorage.getItem('tema-demo'); } catch (e) {}
  if (saved) root.dataset.theme = saved;
  if (btn) {
    btn.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('tema-demo', next); } catch (e) {}
    });
  }
}

renderSaldo();
renderMovs();
renderStock();
renderReceta();
initTema();
