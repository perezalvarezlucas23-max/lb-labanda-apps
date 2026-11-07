/* ===================== Adaptador Google Sheets (Apps Script) =====================
 * Instalación (detalle en docs/STAGING.md):
 *  1. En la hoja: Extensiones > Apps Script. Borra todo y pega ESTE archivo completo (dist/lb-api.gs).
 *  2. Configuración del proyecto > Propiedades del script > API_TOKEN = una clave larga.
 *  3. Implementar > Nueva implementación > Aplicación web · Ejecutar como: Yo · Acceso: Cualquier usuario.
 *  4. Copia la URL /exec en shared/config.js (STAGING o PROD) junto al mismo API_TOKEN.
 */
var LB_TZ = 'America/Bogota';
var LB_CACHE_ = {};

function lbFmt_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (v.getFullYear() < 1900) return Utilities.formatDate(v, LB_TZ, 'HH:mm');
    var hm = Utilities.formatDate(v, LB_TZ, 'HH:mm');
    return Utilities.formatDate(v, LB_TZ, 'yyyy-MM-dd') + (hm !== '00:00' ? ' ' + hm : '');
  }
  return v;
}

function lbDb_() {
  var ss = SpreadsheetApp.getActive();
  function hoja(t) { var h = ss.getSheetByName(t); if (!h) throw new Error('Falta la pestaña ' + t); return h; }
  function cab(t) {
    if (!LB_CACHE_[t]) { var h = hoja(t); LB_CACHE_[t] = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].map(String); }
    return LB_CACHE_[t];
  }
  return {
    list: function (t) {
      var h = hoja(t), n = h.getLastRow(), c = cab(t);
      if (n < 2) return [];
      var vals = h.getRange(2, 1, n - 1, c.length).getValues(), out = [];
      vals.forEach(function (f, i) {
        if (f[0] === '' || f[0] === null) return;
        var o = { _row: i + 2 };
        c.forEach(function (col, j) { o[col] = lbFmt_(f[j]); });
        out.push(o);
      });
      return out;
    },
    insert: function (t, row) {
      var h = hoja(t), c = cab(t), fila = h.getLastRow() + 1;
      h.getRange(fila, 1, 1, c.length).setValues([c.map(function (col) { return row[col] === undefined ? '' : row[col]; })]);
      var o = { _row: fila }; c.forEach(function (col) { o[col] = row[col] === undefined ? '' : row[col]; });
      return o;
    },
    update: function (t, rowIdx, cambios) {
      var h = hoja(t), c = cab(t);
      Object.keys(cambios).forEach(function (k) {
        var j = c.indexOf(k);
        if (j > 0) h.getRange(rowIdx, j + 1).setValue(cambios[k]);
      });
    }
  };
}

function lbServer_() {
  var cache = CacheService.getScriptCache();
  return LB.createServer(lbDb_(), {
    token: PropertiesService.getScriptProperties().getProperty('API_TOKEN'),
    now: function () {
      var d = new Date();
      return { fecha: Utilities.formatDate(d, LB_TZ, 'yyyy-MM-dd'), hora: Utilities.formatDate(d, LB_TZ, 'HH:mm'),
        stamp: Utilities.formatDate(d, LB_TZ, 'yyyy-MM-dd HH:mm') };
    },
    sessions: {
      get: function (k) { var v = cache.get('s_' + k); return v ? JSON.parse(v) : null; },
      put: function (k, v, seg) { cache.put('s_' + k, JSON.stringify(v), Math.min(seg || 21600, 21600)); }
    },
    newKey: function () { return Utilities.getUuid() + Utilities.getUuid().slice(0, 8); },
    lock: function (fn) {
      var l = LockService.getScriptLock();
      l.waitLock(15000);
      try { LB_CACHE_ = {}; return fn(); } finally { SpreadsheetApp.flush(); l.releaseLock(); }
    }
  });
}

function lbResponder_(p) {
  var out;
  try { out = { ok: true, data: lbServer_().handle(p) }; }
  catch (e) { out = { ok: false, error: e.lb ? e.message : 'Error del servidor: ' + e.message }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) { return lbResponder_((e && e.parameter) || {}); }
function doPost(e) {
  var p;
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { p = {}; }
  return lbResponder_(p);
}

/** Ejecútala una vez desde el editor para verificar que la hoja tiene todas las pestañas. */
function probarInstalacion() {
  var db = lbDb_();
  ['Sedes', 'Equipo', 'Servicios', 'Horarios', 'Bloqueos', 'Clientes', 'Citas', 'Productos', 'Inventario', 'Ventas', 'Puntos']
    .forEach(function (t) { Logger.log(t + ': ' + db.list(t).length + ' filas'); });
  Logger.log('API_TOKEN configurado: ' + !!PropertiesService.getScriptProperties().getProperty('API_TOKEN'));
}
