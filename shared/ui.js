/* Utilidades de interfaz compartidas por las dos apps. */
(function () {
  'use strict';
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'html') el.innerHTML = v;            // solo para íconos estáticos
      else if (/^on[A-Z]/.test(k)) el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }

  var ICONS = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-3.5 3.8-5 7-5s6 1.5 7 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.4 2.2 4 5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 20M8.1 15.9 20 4"/>',
    out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    chevL: '<path d="M15 18l-6-6 6-6"/>', chevR: '<path d="M9 6l6 6-6 6"/>',
    store: '<path d="M4 9h16l-1-5H5zM5 9v11h14V9"/><path d="M10 20v-6h4v6"/>',
    box: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'
  };
  function icon(name, size) {
    var s = size || 22;
    return h('span', { 'aria-hidden': 'true', style: 'display:inline-flex',
      html: '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>' });
  }

  var fmtCOP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  function money(n) { return fmtCOP.format(Number(n) || 0); }
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  function partes(f) { var p = String(f).split('-'); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); return { dow: d.getUTCDay(), d: +p[2], m: +p[1] - 1 }; }
  function fechaCorta(f) { var x = partes(f); return DIA[x.dow] + ' ' + x.d + ' ' + MES[x.m]; }
  function hora12(hm) {
    if (!hm) return '';
    var p = String(hm).split(':'), H = +p[0], ap = H >= 12 ? 'p. m.' : 'a. m.';
    return ((H % 12) || 12) + ':' + p[1] + ' ' + ap;
  }
  function iniciales(n) { return String(n || '?').replace(/\[|\]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || '?'; }

  var toastTimer;
  function toast(msg, err) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = h('div', { class: 'toast' + (err ? ' err' : ''), role: 'status' }, msg);
    document.body.appendChild(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.remove(); }, err ? 4500 : 2600);
  }
  function sheet(titulo, contenido) {
    var bg = h('div', { class: 'sheet-bg', onClick: function (e) { if (e.target === bg) cerrar(); } });
    function tecla(e) { if (e.key === 'Escape') cerrar(); }
    function cerrar() { bg.remove(); document.removeEventListener('keydown', tecla); window.removeEventListener('hashchange', cerrar); }
    document.addEventListener('keydown', tecla);
    setTimeout(function () { window.addEventListener('hashchange', cerrar); }, 0);
    bg.appendChild(h('div', { class: 'sheet', role: 'dialog', 'aria-label': titulo },
      h('div', { class: 'row between' }, h('h2', null, titulo), h('button', { class: 'icon-btn', 'aria-label': 'Cerrar', onClick: cerrar }, '✕')),
      typeof contenido === 'function' ? contenido(cerrar) : contenido));
    document.body.appendChild(bg);
    return cerrar;
  }
  function confirmar(titulo, texto, ok) {
    sheet(titulo, function (cerrar) {
      return h('div', { class: 'col', style: 'gap:14px' }, h('p', { class: 'muted', style: 'margin:0;line-height:1.5' }, texto),
        h('button', { class: 'btn', onClick: function () { cerrar(); ok(); } }, 'Sí, continuar'),
        h('button', { class: 'btn ghost', onClick: cerrar }, 'Volver'));
    });
  }
  /** Ejecuta una llamada mostrando carga en el botón y errores como toast. */
  function accion(btn, promesa, okMsg) {
    var txt = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Un momento…'; }
    return promesa.then(function (r) { if (okMsg) toast(okMsg); return r; })
      .catch(function (e) { toast(e.message, true); throw e; })
      .finally(function () { if (btn) { btn.disabled = false; btn.textContent = txt; } });
  }

  function envBanner(onReset) {
    var env = window.LBApi.env;
    if (env === 'PROD') return null;
    if (env === 'STAGING') return h('div', { class: 'env staging' }, 'STAGING · conectado a la hoja de pruebas');
    return h('div', { class: 'env' }, 'QA · datos de prueba en este dispositivo',
      h('button', { onClick: function () { credenciales(); } }, 'Usuarios de prueba'),
      h('button', { onClick: function () { confirmar('Reiniciar datos de prueba', 'Se borran las reservas y cambios hechos en QA en este dispositivo.', function () { window.LBApi.resetQA(); if (onReset) onReset(); location.reload(); }); } }, 'Reiniciar'));
  }
  function credenciales() {
    sheet('Usuarios de prueba (QA)', h('div', { class: 'card list' }, window.LBQA.CREDENCIALES.map(function (c) {
      return h('div', { class: 'row between' }, h('div', { class: 'col', style: 'gap:2px' }, h('span', { class: 'strong' }, c.nombre), h('span', { class: 'small muted' }, c.rol)),
        h('div', { class: 'col', style: 'gap:2px;text-align:right' }, h('span', null, c.celular), h('span', { class: 'small muted' }, 'Clave: ' + c.pin)));
    })));
  }

  /** Botón de instalación (Android) y guía para iPhone. */
  var promptInstalar = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); promptInstalar = e; document.dispatchEvent(new Event('lb-installable')); });
  function instalado() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone; }
  function esIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function botonInstalar(nombreApp) {
    if (instalado()) return null;
    var b = h('button', { class: 'btn ghost', onClick: function () {
      if (promptInstalar) { promptInstalar.prompt(); promptInstalar = null; return; }
      sheet('Instalar ' + nombreApp, h('div', { class: 'col', style: 'gap:10px;line-height:1.6' },
        esIOS() ? [h('p', { style: 'margin:0' }, '1. Abre este enlace en Safari.'), h('p', { style: 'margin:0' }, '2. Toca el botón Compartir (cuadro con flecha).'), h('p', { style: 'margin:0' }, '3. Elige "Agregar a inicio" y luego "Agregar".')]
          : [h('p', { style: 'margin:0' }, '1. Abre el menú ⋮ de Chrome.'), h('p', { style: 'margin:0' }, '2. Toca "Instalar app" o "Agregar a la pantalla principal".')]));
    } }, icon('download', 18), 'Instalar la app en este celular');
    return b;
  }

  function registrarSW() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(function () {});
  }

  window.UI = { h: h, icon: icon, money: money, fechaCorta: fechaCorta, hora12: hora12, iniciales: iniciales, toast: toast, sheet: sheet,
    confirmar: confirmar, accion: accion, envBanner: envBanner, botonInstalar: botonInstalar, registrarSW: registrarSW, DIA: DIA, MES: MES };
})();
