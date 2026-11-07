// Prueba dist/lb-api.gs dentro de un Apps Script simulado (hoja en memoria con conversión de fechas como Google Sheets).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const QA = require('../shared/qa-backend.js');

require('../scripts/build-gs.js');
const CODE = fs.readFileSync(path.join(__dirname, '../dist/lb-api.gs'), 'utf8');
const OFF = 5 * 3600 * 1000; // Bogotá UTC-5

function aCelda(v) { // Sheets convierte textos con forma de fecha/hora al escribirlos
  if (typeof v !== 'string') return v;
  let m;
  if ((m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/))) return new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) + OFF);
  if ((m = v.match(/^(\d{2}):(\d{2})$/))) return new Date(Date.UTC(1899, 11, 30, +m[1], +m[2]) + OFF);
  return v;
}
function formatDate(d, tz, fmt) {
  const b = new Date(d.getTime() - OFF), p = (n) => String(n).padStart(2, '0');
  return fmt.replace('yyyy', b.getUTCFullYear()).replace('MM', p(b.getUTCMonth() + 1)).replace('dd', p(b.getUTCDate()))
    .replace('HH', p(b.getUTCHours())).replace('mm', p(b.getUTCMinutes()));
}
function hojaFalsa(cols, filas) {
  const data = [cols.slice()].concat(filas.map((r) => cols.map((c) => aCelda(r[c] === undefined ? '' : r[c]))));
  return {
    data,
    getLastRow: () => { for (let i = data.length - 1; i >= 0; i--) if (data[i].some((v) => v !== '')) return i + 1; return 0; },
    getLastColumn: () => cols.length,
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((data[r - 1 + i] || [])[c - 1 + j] ?? ''))),
      setValues: (vals) => vals.forEach((fila, i) => { data[r - 1 + i] = data[r - 1 + i] || cols.map(() => ''); fila.forEach((v, j) => { data[r - 1 + i][c - 1 + j] = aCelda(v); }); }),
      setValue: (v) => { data[r - 1] = data[r - 1] || cols.map(() => ''); data[r - 1][c - 1] = aCelda(v); }
    })
  };
}
function montarGs(reloj) {
  const semilla = QA.semilla(reloj.fecha);
  const hojas = {};
  Object.keys(QA.COLUMNAS).forEach((t) => { hojas[t] = hojaFalsa(QA.COLUMNAS[t], semilla[t]); });
  const cache = {};
  const realDate = Date;
  const FakeDate = class extends realDate { constructor(...a) { if (a.length) super(...a); else super(reloj.ms); } static now() { return reloj.ms; } };
  const ctx = {
    Date: FakeDate, Math, JSON, String, Number, Object, Array, RegExp, Error, isFinite, unescape, encodeURIComponent,
    SpreadsheetApp: { getActive: () => ({ getSheetByName: (n) => hojas[n] || null }), flush: () => {} },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'API_TOKEN' ? 'tok-staging' : null) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: { formatDate, getUuid: () => require('crypto').randomUUID() },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ s, setMimeType() { return this; } }) },
    Logger: { log: () => {} }
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  const post = (p) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ token: 'tok-staging' }, p)) } }).s);
  return { post, hojas, ctx };
}

test('API de Sheets: flujo completo cliente → barbero → admin', () => {
  const reloj = { fecha: '2026-11-09', ms: Date.UTC(2026, 10, 9, 8, 0) + OFF }; // lunes 8:00 a. m. Bogotá
  const { post, hojas } = montarGs(reloj);

  assert.strictEqual(post({ action: 'ping', token: 'otro' }).ok, false);
  const cat = post({ action: 'catalogo' });
  assert.ok(cat.ok, cat.error);
  assert.strictEqual(cat.data.hoy, '2026-11-09');
  assert.strictEqual(cat.data.sedes[0].horario_apertura, '09:00', 'las horas vuelven como texto HH:MM');

  const disp = post({ action: 'disponibilidad', id_barbero: 'B1', fecha: '2026-11-09', id_servicio: 'SV4' });
  assert.ok(disp.data.slots.includes('09:00') && !disp.data.slots.includes('16:30'));

  const cli = post({ action: 'loginCliente', celular: '+57 310 000 0001' });
  assert.ok(cli.ok, cli.error);
  const nuevo = post({ action: 'loginCliente', celular: '3209998877', nombre: 'Cliente Staging' });
  assert.ok(nuevo.ok);
  const res = post({ action: 'reservar', session: cli.data.session, id_barbero: 'B1', id_sede: 'S1', id_servicio: 'SV4', fecha: '2026-11-09', hora_inicio: '09:00' });
  assert.ok(res.ok, res.error);
  const fila = hojas.Citas.data[hojas.Citas.getLastRow() - 1];
  assert.ok(fila[1] instanceof Date, 'la fecha queda guardada como fecha real en la hoja (para las fórmulas de Resumen)');
  const doble = post({ action: 'reservar', session: cli.data.session, id_barbero: 'B1', id_sede: 'S1', id_servicio: 'SV1', fecha: '2026-11-09', hora_inicio: '09:30' });
  assert.strictEqual(doble.ok, false);

  const bar = post({ action: 'loginEquipo', celular: '3000000001', pin: '1111' });
  assert.ok(bar.ok, bar.error);
  const ag = post({ action: 'miAgenda', session: bar.data.session });
  assert.ok(ag.data.citas.some((c) => c.id_cita === res.data.id_cita && c.hora_inicio === '09:00'));
  const marca = post({ action: 'marcarCita', session: bar.data.session, id: res.data.id_cita, estado: 'completada' });
  assert.strictEqual(marca.data.comision, 20000);

  const adm = post({ action: 'loginEquipo', celular: '3000000000', pin: '0000' });
  const datos = post({ action: 'adminData', session: adm.data.session, desde: '2026-11-09', hasta: '2026-11-09' });
  const c = datos.data.citas.find((x) => x.id_cita === res.data.id_cita);
  assert.strictEqual(c.estado, 'completada');
  assert.strictEqual(c.comision, 20000);
  assert.ok(datos.data.equipo.every((u) => u.clave_hash === undefined), 'nunca devuelve claves');
  assert.strictEqual(post({ action: 'adminData', session: bar.data.session }).ok, false, 'barbero no entra a admin');
  const misDatos = post({ action: 'misDatos', session: cli.data.session });
  assert.strictEqual(misDatos.data.saldo, 50);
});
