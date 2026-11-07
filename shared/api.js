/* Cliente de la API. En QA usa la lógica local; en STAGING/PROD llama a la API de Google Sheets. */
(function () {
  'use strict';
  var cfg = window.LB_CONFIG || {};
  var KEY_ENV = 'lb_env', KEY_DB = 'lb_qa_db', KEY_SES = 'lb_qa_sessions';

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

  var qp = new URLSearchParams(location.search).get('env');
  if (qp && /^(qa|staging)$/i.test(qp)) store(KEY_ENV, qp.toUpperCase());
  var env = (store(KEY_ENV) || cfg.ambientePorDefecto || 'QA').toUpperCase();
  if (env !== 'QA' && !(cfg[env] && cfg[env].apiUrl)) env = 'QA';

  var backend;
  if (env === 'QA') {
    // Se relee en cada llamada para que las dos apps (pestañas distintas) vean siempre los mismos datos.
    var leerTablas = function () {
      var t;
      try { t = JSON.parse(store(KEY_DB) || 'null'); } catch (e) { t = null; }
      if (!t) { t = LBQA.semilla(LBQA.horaColombia().fecha); store(KEY_DB, JSON.stringify(t)); }
      return t;
    };
    var persistir = function (t) { store(KEY_DB, JSON.stringify(t)); };
    var db = {
      list: function (n) { return LBQA.createDb(leerTablas()).list(n); },
      insert: function (n, row) { return LBQA.createDb(leerTablas(), persistir).insert(n, row); },
      update: function (n, r, c) { return LBQA.createDb(leerTablas(), persistir).update(n, r, c); }
    };
    var sesiones = {
      get: function (k) { try { return JSON.parse(store(KEY_SES) || '{}')[k] || null; } catch (e) { return null; } },
      put: function (k, v) { var m; try { m = JSON.parse(store(KEY_SES) || '{}'); } catch (e) { m = {}; } m[k] = v; store(KEY_SES, JSON.stringify(m)); }
    };
    var server = LB.createServer(db, {
      token: 'qa-token', now: function () { return LBQA.horaColombia(); }, sessions: sesiones,
      newKey: function () { return (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)) ; },
      lock: function (fn) { return fn(); }
    });
    backend = function (p) {
      return new Promise(function (ok, ko) {
        setTimeout(function () {
          try { ok(JSON.parse(JSON.stringify(server.handle(Object.assign({}, p, { token: 'qa-token' }))))); }
          catch (e) { ko(new Error(e.lb ? e.message : 'Error interno: ' + e.message)); }
        }, 120);
      });
    };
  } else {
    var c = cfg[env];
    backend = function (p) {
      return fetch(c.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({}, p, { token: c.appToken })) })
        .then(function (r) { return r.json(); })
        .catch(function () { throw new Error('Sin conexión con el servidor. Revisa tu internet.'); })
        .then(function (j) { if (!j.ok) throw new Error(j.error || 'Error del servidor'); return j.data; });
    };
  }

  window.LBApi = {
    env: env,
    call: function (action, params) { return backend(Object.assign({ action: action }, params || {})); },
    resetQA: function () { store(KEY_DB, null); store(KEY_SES, null); },
    setEnv: function (e) { store(KEY_ENV, e); }
  };
})();
