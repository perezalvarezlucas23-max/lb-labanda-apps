/* App La Banda – clientes */
(function () {
  'use strict';
  var h = UI.h, icon = UI.icon, money = UI.money;
  var EMBLEMA = '../shared/img/lb-emblema.png', WORDMARK = '../shared/img/lb-wordmark.png';

  function get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  var pref = 'lb_cli_' + LBApi.env + '_';
  var S = { session: get(pref + 'session'), cliente: get(pref + 'cliente'), draft: get(pref + 'draft') || {}, cart: get(pref + 'cart') || [], cat: null, ultima: null };
  function guardarDraft() { set(pref + 'draft', S.draft); }
  function guardarCart() { set(pref + 'cart', S.cart); }

  function api(action, p) {
    return LBApi.call(action, Object.assign({ session: S.session }, p || {})).catch(function (e) {
      if (/sesión terminó/i.test(e.message)) { salir(); }
      throw e;
    });
  }
  function catalogo(force) {
    if (S.cat && !force) return Promise.resolve(S.cat);
    return LBApi.call('catalogo').then(function (c) { S.cat = c; return c; });
  }
  function salir() { S.session = null; S.cliente = null; set(pref + 'session', null); set(pref + 'cliente', null); go(''); }
  function go(r) { if (location.hash === '#/' + r) render(); else location.hash = '#/' + r; }
  function porId(lista, col, id) { return (lista || []).filter(function (x) { return x[col] === id; })[0]; }
  function sedesDe(b) { return String(b.id_sede || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  function hace(b, idServicio) { var s = String(b.servicios || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); return !s.length || s.indexOf(idServicio) >= 0; }
  function nombreBonito(n) { return String(n || '').replace(/^\[|\]$/g, ''); }

  // ---------- piezas ----------
  function top(atras, texto) {
    return h('div', { class: 'row' }, atras ? h('a', { class: 'icon-btn', href: '#/' + atras, 'aria-label': 'Volver' }, icon('back', 20)) : null,
      texto ? h('span', { class: 'small muted' }, texto) : null);
  }
  function progreso(n) { var p = h('div', { class: 'progress', 'aria-label': 'Paso ' + n + ' de 4' }); for (var i = 1; i <= 4; i++) p.appendChild(h('i', { class: i <= n ? 'on' : '' })); return p; }
  function nav(activo) {
    var items = [['inicio', 'home', 'Inicio'], ['reservar/sede', 'cal', 'Reservar'], ['tienda', 'bag', 'Tienda'], ['perfil', 'user', 'Perfil']];
    return h('nav', { class: 'nav', 'aria-label': 'Menú' }, items.map(function (it) {
      return h('a', { href: '#/' + it[0], class: activo === it[0] ? 'on' : '', 'aria-current': activo === it[0] ? 'page' : null }, icon(it[1]), it[2]);
    }));
  }
  function avatar(b, on) {
    return h('span', { class: 'avatar' + (on ? ' on' : '') }, b.foto_url ? h('img', { src: b.foto_url, alt: '' }) : UI.iniciales(nombreBonito(b.nombre)));
  }
  function filaDato(k, v) { return h('div', { class: 'row between' }, h('span', { class: 'muted' }, k), h('span', { class: 'strong', style: 'text-align:right' }, v)); }
  function badgeEstado(e) {
    var m = { confirmada: ['ok', 'Confirmada'], pendiente: ['warn', 'Pendiente'], completada: ['gray', 'Atendida'], cancelada: ['gray', 'Cancelada'], no_asistio: ['red', 'No asistió'],
      pagada: ['ok', 'Pagada'], entregada: ['gray', 'Entregada'] };
    var x = m[e] || ['gray', e];
    return h('span', { class: 'badge ' + x[0] }, x[1]);
  }

  // ---------- pantallas ----------
  function bienvenida() {
    var nombre = h('input', { class: 'input', id: 'nombre', autocomplete: 'name', placeholder: 'Tu nombre' });
    var cel = h('input', { class: 'input', id: 'celular', type: 'tel', inputmode: 'numeric', autocomplete: 'tel', placeholder: '300 000 0000' });
    var btn = h('button', { class: 'btn', type: 'submit' }, 'Entrar');
    var form = h('form', { class: 'col', style: 'gap:12px;width:100%', onSubmit: function (e) {
      e.preventDefault();
      UI.accion(btn, LBApi.call('loginCliente', { celular: cel.value, nombre: nombre.value })).then(function (r) {
        S.session = r.session; S.cliente = r.cliente; set(pref + 'session', r.session); set(pref + 'cliente', r.cliente); go('inicio');
      }).catch(function () {});
    } },
      h('label', { class: 'field', for: 'celular' }, 'Celular', cel),
      h('label', { class: 'field', for: 'nombre' }, 'Nombre (solo la primera vez)', nombre),
      btn);
    return h('div', { class: 'screen no-nav', style: 'align-items:center;padding-top:48px' },
      h('img', { src: EMBLEMA, alt: 'LB La Banda', width: 200, height: 200 }),
      h('img', { src: WORDMARK, alt: 'La Banda, original ñea de barrio', style: 'width:280px;margin-top:8px' }),
      h('p', { class: 'muted center', style: 'margin:8px 0 6px;line-height:1.5' }, 'Reserva tu corte, compra en la tienda y suma puntos en cada visita.'),
      form, UI.botonInstalar('La Banda'));
  }

  function inicio() {
    return Promise.all([catalogo(true), api('misDatos')]).then(function (r) {
      var cat = r[0], d = r[1];
      var prox = d.citas.filter(function (c) { return (c.estado === 'confirmada' || c.estado === 'pendiente') && c.fecha >= d.hoy; })[0];
      return h('div', { class: 'screen' },
        h('div', { class: 'row between' }, h('div', { class: 'row', style: 'gap:10px' }, h('img', { src: EMBLEMA, alt: 'LB', width: 52, height: 52 }),
          h('img', { src: WORDMARK, alt: 'La Banda', style: 'width:160px' }))),
        h('p', { class: 'muted', style: 'margin:0' }, 'Hola, ', h('span', { class: 'strong', style: 'color:var(--text)' }, d.cliente.nombre)),
        prox ? h('a', { href: '#/perfil', class: 'card hot', style: 'color:var(--text);display:flex;flex-direction:column;gap:4px' },
          h('span', { class: 'eyebrow' }, 'Tu próxima cita'),
          h('span', { class: 'strong', style: 'font-size:17px' }, UI.fechaCorta(prox.fecha) + ' · ' + UI.hora12(prox.hora_inicio)),
          h('span', { class: 'small muted' }, prox.servicio_nombre + ' · ' + prox.barbero_nombre + ' · ' + prox.sede_nombre)) : null,
        h('div', { class: 'card', style: 'padding:22px;display:flex;flex-direction:column;gap:12px' },
          h('span', { class: 'eyebrow' }, 'Agenda en 1 minuto'),
          h('h1', { style: 'font-size:42px' }, 'Reserva', h('br'), 'tu turno'),
          h('p', { class: 'muted', style: 'margin:0;font-size:14px' }, 'Elige sede, servicio, barbero y hora.'),
          h('a', { class: 'btn', href: '#/reservar/sede', onClick: function () { S.draft = {}; guardarDraft(); } }, 'Reservar ahora')),
        h('a', { href: '#/perfil', class: 'card row between', style: 'color:var(--text)' },
          h('span', { class: 'col', style: 'gap:2px' }, h('span', { class: 'small muted' }, 'Tus puntos LB'), h('span', { class: 'display', style: 'font-size:24px;color:var(--red-text)' }, d.saldo + ' pts')),
          h('span', { class: 'small strong', style: 'color:var(--red-text)' }, 'Ver beneficios')),
        h('h2', null, 'Nuestras sedes'),
        h('div', { class: 'grid2' }, cat.sedes.map(function (s) {
          return h('div', { class: 'card tight col' }, h('span', { style: 'color:var(--red-text)' }, icon('pin', 20)), h('span', { class: 'strong' }, nombreBonito(s.nombre)),
            h('span', { class: 'small muted' }, s.direccion || 'Dirección por confirmar'), s.horario_apertura ? h('span', { class: 'small muted' }, UI.hora12(s.horario_apertura) + ' – ' + UI.hora12(s.horario_cierre)) : null);
        })),
        cat.productos.length ? [h('div', { class: 'row between' }, h('h2', null, 'Nuevo en la tienda'), h('a', { href: '#/tienda', class: 'small strong' }, 'Ver todo')),
          h('div', { class: 'grid2' }, cat.productos.slice(0, 2).map(tarjetaProducto))] : null,
        UI.botonInstalar('La Banda'));
    });
  }

  function pasoSede() {
    return catalogo(true).then(function (cat) {
      return h('div', { class: 'screen' }, top('inicio', 'Paso 1 de 4'), progreso(1), h('h1', null, '¿En qué sede', h('br'), 'te atendemos?'),
        cat.sedes.length ? cat.sedes.map(function (s) {
          var on = S.draft.id_sede === s.id_sede;
          return h('button', { class: 'card' + (on ? ' hot' : ''), style: 'text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:6px;color:var(--text)',
            onClick: function () { S.draft = { id_sede: s.id_sede }; guardarDraft(); go('reservar/servicio'); } },
            h('span', { class: 'strong', style: 'font-size:17px' }, nombreBonito(s.nombre)),
            h('span', { class: 'small muted' }, [s.direccion, s.ciudad].filter(Boolean).join(' · ') || 'Dirección por confirmar'),
            s.horario_apertura ? h('span', { class: 'small muted' }, 'Horario: ' + UI.hora12(s.horario_apertura) + ' – ' + UI.hora12(s.horario_cierre)) : null);
        }) : h('div', { class: 'empty' }, 'Aún no hay sedes activas.'));
    });
  }

  function pasoServicio() {
    if (!S.draft.id_sede) { go('reservar/sede'); return null; }
    return catalogo().then(function (cat) {
      var sede = porId(cat.sedes, 'id_sede', S.draft.id_sede) || {};
      return h('div', { class: 'screen' }, top('reservar/sede', 'Paso 2 de 4 · ' + nombreBonito(sede.nombre)), progreso(2), h('h1', null, 'Elige tu servicio'),
        h('div', { class: 'col', style: 'gap:10px' }, cat.servicios.map(function (s) {
          var premium = /premium/i.test(s.nombre), on = S.draft.id_servicio === s.id_servicio;
          return h('button', { class: 'card tight row between' + (on || premium ? ' hot' : ''), style: 'cursor:pointer;color:var(--text);text-align:left;' + (premium && !on ? 'border-width:1px' : ''),
            onClick: function () { S.draft.id_servicio = s.id_servicio; delete S.draft.hora_inicio; guardarDraft(); go('reservar/barbero'); } },
            h('span', { class: 'col', style: 'gap:4px' }, h('span', { class: 'row', style: 'gap:8px' }, h('span', { class: 'strong' }, s.nombre), premium ? h('span', { class: 'badge red', style: 'font-size:10px;letter-spacing:1px' }, 'PREMIUM') : null),
              h('span', { class: 'small muted' }, [s.descripcion, s.duracion_min ? s.duracion_min + ' min' : ''].filter(Boolean).join(' · '))),
            h('span', { class: 'strong' }, s.precio !== '' && s.precio != null ? money(s.precio) : 'Precio en sede'));
        })));
    });
  }

  function barberosElegibles(cat) {
    return cat.barberos.filter(function (b) { var sd = sedesDe(b); return (!sd.length || sd.indexOf(S.draft.id_sede) >= 0) && hace(b, S.draft.id_servicio); });
  }
  function pasoBarbero() {
    if (!S.draft.id_servicio) { go('reservar/servicio'); return null; }
    return catalogo(true).then(function (cat) {
      var lista = barberosElegibles(cat);
      return h('div', { class: 'screen' }, top('reservar/servicio', 'Paso 3 de 4'), progreso(3), h('h1', null, 'Tu barbero'),
        h('span', { class: 'small muted', style: 'margin-top:-8px' }, 'Toca un barbero para ver su perfil y su disponibilidad'),
        h('button', { class: 'card tight row', style: 'cursor:pointer;color:var(--text);text-align:left', onClick: function () { S.draft.id_barbero = 'any'; delete S.draft.hora_inicio; guardarDraft(); go('reservar/horario'); } },
          h('span', { class: 'avatar dashed', style: 'color:var(--muted)' }, icon('scissors')), h('span', { class: 'col grow', style: 'gap:2px' }, h('span', { class: 'strong' }, 'Cualquier barbero disponible'),
            h('span', { class: 'small muted' }, 'Te mostramos todas las horas libres'))),
        lista.length ? lista.map(function (b) {
          return h('a', { href: '#/barbero/' + b.id, class: 'card tight row', style: 'color:var(--text)' }, avatar(b, S.draft.id_barbero === b.id),
            h('span', { class: 'col grow', style: 'gap:3px' }, h('span', { class: 'strong' }, nombreBonito(b.nombre)), b.especialidades ? h('span', { class: 'small muted' }, b.especialidades) : null),
            b.agenda_activa ? h('span', { class: 'badge ok' }, 'Disponible') : h('span', { class: 'badge gray' }, 'Hoy no atiende'));
        }) : h('div', { class: 'empty' }, 'No hay barberos para este servicio en esta sede.'));
    });
  }

  function proximosEspacios(b, idServicio, hoy) {
    var out = [], i = 0;
    function paso() {
      if (out.length >= 3 || i >= 7) return Promise.resolve(out);
      var f = LB.sumarDias(hoy, i++);
      return LBApi.call('disponibilidad', { id_barbero: b.id, fecha: f, id_servicio: idServicio }).then(function (r) {
        r.slots.slice(0, 3 - out.length).forEach(function (s) { out.push({ fecha: f, hora: s }); });
        return paso();
      });
    }
    return b.agenda_activa ? paso() : Promise.resolve([]);
  }
  function perfilBarbero(id) {
    return catalogo(true).then(function (cat) {
      var b = porId(cat.barberos, 'id', id);
      if (!b) return h('div', { class: 'screen' }, top('reservar/barbero'), h('div', { class: 'empty' }, 'Barbero no encontrado.'));
      var idServicio = S.draft.id_servicio || (cat.servicios[0] || {}).id_servicio;
      var espacios = h('div', { class: 'col' }, h('div', { class: 'spinner', style: 'margin:10px auto' }));
      var sedes = sedesDe(b).map(function (s) { return nombreBonito((porId(cat.sedes, 'id_sede', s) || {}).nombre || s); }).join(' · ') || 'Todas las sedes';
      proximosEspacios(b, idServicio, cat.hoy).then(function (lista) {
        espacios.replaceChildren(lista.length ? h('div', { class: 'grid3' }, lista.map(function (x) {
          return h('button', { class: 'slot', style: 'height:56px;font-size:12px;line-height:1.3', onClick: function () {
            S.draft.id_barbero = b.id; S.draft.fecha = x.fecha; S.draft.hora_inicio = x.hora; S.draft.asignado = b.id;
            if (!S.draft.id_sede) S.draft.id_sede = sedesDe(b)[0] || (cat.sedes[0] || {}).id_sede;
            if (!S.draft.id_servicio) S.draft.id_servicio = idServicio;
            guardarDraft(); go('reservar/confirmar');
          } }, (x.fecha === cat.hoy ? 'Hoy' : UI.fechaCorta(x.fecha)), h('br'), UI.hora12(x.hora)); }))
          : h('div', { class: 'empty' }, b.agenda_activa ? 'Sin espacios libres en los próximos días.' : nombreBonito(b.nombre) + ' tiene la agenda pausada. Elige otro barbero.'));
      }).catch(function (e) { espacios.replaceChildren(h('div', { class: 'empty' }, e.message)); });
      return h('div', { class: 'screen no-nav' }, top('reservar/barbero', 'Perfil del barbero'),
        h('div', { class: 'photo', style: 'height:180px' }, b.foto_url ? h('img', { src: b.foto_url, alt: 'Foto de ' + nombreBonito(b.nombre) }) : h('span', { class: 'display', style: 'font-size:56px;color:var(--line2)' }, UI.iniciales(nombreBonito(b.nombre)))),
        h('div', { class: 'row between', style: 'align-items:flex-start' }, h('div', { class: 'col', style: 'gap:4px' }, h('h1', null, nombreBonito(b.nombre)), h('span', { class: 'small muted' }, sedes)),
          b.agenda_activa ? h('span', { class: 'badge ok' }, 'Agenda activa') : h('span', { class: 'badge gray' }, 'Hoy no atiende')),
        b.especialidades ? h('div', { class: 'col', style: 'gap:8px' }, h('span', { class: 'eyebrow', style: 'color:var(--muted)' }, 'Especialidades'),
          h('div', { class: 'chips' }, String(b.especialidades).split(',').map(function (e) { return h('span', { class: 'chip', style: 'cursor:default' }, e.trim()); }))) : null,
        h('div', { class: 'col', style: 'gap:8px' }, h('span', { class: 'eyebrow', style: 'color:var(--muted)' }, 'Próximos espacios libres'), espacios),
        h('div', { class: 'bottom-bar' }, h('button', { class: 'btn', disabled: !b.agenda_activa, onClick: function () {
          S.draft.id_barbero = b.id; delete S.draft.hora_inicio; if (!S.draft.id_servicio) S.draft.id_servicio = idServicio;
          if (!S.draft.id_sede) S.draft.id_sede = sedesDe(b)[0] || (cat.sedes[0] || {}).id_sede; guardarDraft(); go('reservar/horario');
        } }, 'Reservar con ' + nombreBonito(b.nombre))));
    });
  }

  function pasoHorario() {
    if (!S.draft.id_barbero) { go('reservar/barbero'); return null; }
    return catalogo().then(function (cat) {
      var hoy = cat.hoy, d = S.draft;
      if (!d.fecha || d.fecha < hoy) d.fecha = hoy;
      var sv = porId(cat.servicios, 'id_servicio', d.id_servicio) || {};
      var candidatos = d.id_barbero === 'any' ? barberosElegibles(cat).filter(function (b) { return b.agenda_activa; }) : [porId(cat.barberos, 'id', d.id_barbero)].filter(Boolean);
      var nombreB = d.id_barbero === 'any' ? 'Cualquier barbero' : nombreBonito((candidatos[0] || {}).nombre);
      var dias = h('div', { class: 'days', role: 'group', 'aria-label': 'Día' });
      var zona = h('div', { class: 'col' });
      var resumenTxt = h('span', { class: 'strong' });
      var btn = h('button', { class: 'btn', onClick: function () { go('reservar/confirmar'); } }, 'Continuar');
      function pintarResumen() {
        resumenTxt.textContent = (d.fecha === hoy ? 'Hoy' : UI.fechaCorta(d.fecha)) + (d.hora_inicio ? ' · ' + UI.hora12(d.hora_inicio) : ' · elige una hora');
        btn.disabled = !d.hora_inicio;
      }
      function cargar() {
        zona.replaceChildren(h('div', { class: 'spinner', style: 'margin:20px auto' }));
        Promise.all(candidatos.map(function (b) { return LBApi.call('disponibilidad', { id_barbero: b.id, fecha: d.fecha, id_servicio: d.id_servicio }).then(function (r) { return { b: b, slots: r.slots }; }); }))
          .then(function (rs) {
            var mapa = {};
            rs.forEach(function (r) { r.slots.forEach(function (s) { if (!mapa[s]) mapa[s] = r.b.id; }); });
            var horas = Object.keys(mapa).sort();
            if (!candidatos.length) { zona.replaceChildren(h('div', { class: 'empty' }, 'Este barbero tiene la agenda pausada. Vuelve y elige otro.')); return; }
            if (!horas.length) { zona.replaceChildren(h('div', { class: 'empty' }, 'No hay horas libres este día. Prueba otro día.')); return; }
            zona.replaceChildren(h('div', { class: 'slots', role: 'group', 'aria-label': 'Horas libres' }, horas.map(function (s) {
              return h('button', { class: 'slot' + (d.hora_inicio === s ? ' on' : ''), 'aria-pressed': d.hora_inicio === s ? 'true' : 'false', onClick: function (e) {
                d.hora_inicio = s; d.asignado = mapa[s]; guardarDraft();
                zona.querySelectorAll('.slot').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
                e.currentTarget.classList.add('on'); e.currentTarget.setAttribute('aria-pressed', 'true'); pintarResumen();
              } }, UI.hora12(s));
            })));
          }).catch(function (e) { zona.replaceChildren(h('div', { class: 'empty' }, e.message)); });
      }
      for (var i = 0; i < 14; i++) (function (f) {
        var p = f.split('-'), dow = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
        dias.appendChild(h('button', { class: 'day' + (f === d.fecha ? ' on' : ''), 'aria-pressed': f === d.fecha ? 'true' : 'false', onClick: function (e) {
          d.fecha = f; delete d.hora_inicio; guardarDraft();
          dias.querySelectorAll('.day').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
          e.currentTarget.classList.add('on'); e.currentTarget.setAttribute('aria-pressed', 'true'); pintarResumen(); cargar();
        } }, h('small', null, f === hoy ? 'Hoy' : UI.DIA[dow]), h('b', null, +p[2])));
      })(LB.sumarDias(hoy, i));
      pintarResumen(); cargar();
      return h('div', { class: 'screen no-nav', style: 'padding-bottom:190px' }, top('reservar/barbero', 'Paso 4 de 4 · ' + sv.nombre), progreso(4), h('h1', null, '¿Cuándo vienes?'),
        h('span', { class: 'small muted', style: 'margin-top:-8px' }, nombreB), dias, h('span', { class: 'eyebrow', style: 'color:var(--muted)' }, 'Horas disponibles'), zona,
        h('div', { class: 'bottom-bar' }, h('div', { class: 'row between' }, h('span', { class: 'col', style: 'gap:2px' }, h('span', { class: 'small muted' }, sv.nombre + ' · ' + nombreB), resumenTxt),
          h('span', { class: 'strong' }, sv.precio !== '' && sv.precio != null ? money(sv.precio) : '')), btn));
    });
  }

  function pasoConfirmar() {
    var d = S.draft;
    if (!d.hora_inicio || !d.asignado) { go('reservar/horario'); return null; }
    return catalogo().then(function (cat) {
      var sv = porId(cat.servicios, 'id_servicio', d.id_servicio) || {}, b = porId(cat.barberos, 'id', d.asignado) || {}, sd = porId(cat.sedes, 'id_sede', d.id_sede) || {};
      var notas = h('textarea', { class: 'input', id: 'notas', maxlength: 200, placeholder: 'Ej. quiero el mismo corte de la última vez' });
      var btn = h('button', { class: 'btn' }, 'Confirmar reserva');
      btn.addEventListener('click', function () {
        UI.accion(btn, api('reservar', { id_barbero: d.asignado, id_sede: d.id_sede, id_servicio: d.id_servicio, fecha: d.fecha, hora_inicio: d.hora_inicio, notas: notas.value }))
          .then(function (cita) { S.ultima = cita; S.draft = {}; guardarDraft(); go('reservar/listo'); })
          .catch(function () { /* el horario pudo ocuparse: el toast ya avisa */ });
      });
      return h('div', { class: 'screen no-nav', style: 'padding-bottom:140px' }, top('reservar/horario', 'Revisa tu reserva'), h('h1', null, 'Confirma tu cita'),
        h('div', { class: 'card col', style: 'gap:14px' },
          filaDato('Fecha', (d.fecha === cat.hoy ? 'Hoy, ' : '') + UI.fechaCorta(d.fecha)), filaDato('Hora', UI.hora12(d.hora_inicio)),
          filaDato('Sede', nombreBonito(sd.nombre)), filaDato('Barbero', nombreBonito(b.nombre)), filaDato('Servicio', sv.nombre),
          h('div', { style: 'height:1px;background:var(--line)' }), filaDato('Total a pagar en sede', sv.precio !== '' && sv.precio != null ? money(sv.precio) : 'Por confirmar')),
        h('label', { class: 'field', for: 'notas' }, 'Nota para el barbero (opcional)', notas),
        h('div', { class: 'bottom-bar' }, btn));
    });
  }

  function descargarICS(c) {
    var f = c.fecha.replace(/-/g, ''), ini = c.hora_inicio.replace(':', '') + '00', fin = c.hora_fin.replace(':', '') + '00';
    var txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LB La Banda//Citas//ES', 'BEGIN:VEVENT', 'UID:' + c.id_cita + '@labanda',
      'DTSTART;TZID=America/Bogota:' + f + 'T' + ini, 'DTEND;TZID=America/Bogota:' + f + 'T' + fin,
      'SUMMARY:' + c.servicio_nombre + ' – La Banda', 'LOCATION:' + c.sede_nombre, 'DESCRIPTION:Barbero: ' + c.barbero_nombre, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = h('a', { href: URL.createObjectURL(new Blob([txt], { type: 'text/calendar' })), download: 'cita-la-banda.ics' });
    document.body.appendChild(a); a.click(); a.remove();
  }
  function listo() {
    var c = S.ultima;
    if (!c) { go('perfil'); return null; }
    var pts = Math.floor(LB.num(c.valor) / 1000 * LB.PUNTOS_POR_MIL);
    return h('div', { class: 'screen no-nav', style: 'align-items:center;padding-top:44px' },
      h('div', { style: 'position:relative;width:120px;height:120px' }, h('img', { src: EMBLEMA, alt: '', width: 120, height: 120 }),
        h('span', { style: 'position:absolute;right:-4px;bottom:-4px;width:40px;height:40px;border-radius:20px;background:var(--red);border:3px solid var(--bg);color:#fff;display:flex;align-items:center;justify-content:center' }, icon('check', 20))),
      h('h1', { class: 'center', style: 'font-size:36px' }, '¡Listo!', h('br'), 'Te esperamos'),
      h('div', { class: 'card col', style: 'gap:12px;align-self:stretch' }, filaDato('Fecha', UI.fechaCorta(c.fecha) + ' · ' + UI.hora12(c.hora_inicio)),
        filaDato('Sede', nombreBonito(c.sede_nombre)), filaDato('Barbero', nombreBonito(c.barbero_nombre)), filaDato('Servicio', c.servicio_nombre), filaDato('Total a pagar en sede', money(c.valor))),
      pts > 0 ? h('div', { class: 'card hot center small', style: 'align-self:stretch;border-width:1px;color:var(--red-light)' }, 'Ganarás +' + pts + ' puntos LB al completar tu cita') : null,
      h('div', { class: 'col', style: 'gap:10px;align-self:stretch' }, h('button', { class: 'btn ghost', onClick: function () { descargarICS(c); } }, 'Agregar a mi calendario'),
        h('a', { class: 'btn', href: '#/inicio' }, 'Volver al inicio')));
  }

  // ---------- tienda ----------
  function enCarrito(id) { return S.cart.filter(function (x) { return x.id_producto === id; })[0]; }
  function agregar(p) { var x = enCarrito(p.id_producto); if (x) x.cantidad = Math.min(20, x.cantidad + 1); else S.cart.push({ id_producto: p.id_producto, cantidad: 1 }); guardarCart(); UI.toast(p.nombre + ' agregado al carrito'); }
  function tarjetaProducto(p) {
    return h('div', { class: 'product' }, h('div', { class: 'photo' }, p.imagen_url ? h('img', { src: p.imagen_url, alt: p.nombre }) : 'Foto del producto'),
      h('div', { class: 'body' }, h('span', { class: 'strong', style: 'font-size:14px' }, p.nombre), h('div', { class: 'row between', style: 'margin-top:auto' },
        h('span', { class: 'strong' }, money(p.precio)),
        h('button', { class: 'btn sm', style: 'width:44px;padding:0;font-size:22px', 'aria-label': 'Agregar ' + p.nombre + ' al carrito', onClick: function () { agregar(p); pintarContador(); } }, '+'))));
  }
  var contador;
  function pintarContador() { if (contador) { var n = S.cart.reduce(function (t, x) { return t + x.cantidad; }, 0); contador.textContent = n; contador.style.display = n ? 'flex' : 'none'; } }
  function tienda(cat_) {
    return catalogo(true).then(function (cat) {
      var filtro = 'Todo', grid = h('div', { class: 'grid2' });
      var cats = ['Todo'].concat(cat.productos.map(function (p) { return p.categoria; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; }));
      var NOMBRES = { ropa: 'Ropa', accesorios: 'Accesorios', grooming: 'Barba y cabello', merch: 'Merch' };
      var chips = h('div', { class: 'chips' });
      function pintar() {
        chips.replaceChildren.apply(chips, cats.map(function (c) { return h('button', { class: 'chip' + (c === filtro ? ' on' : ''), onClick: function () { filtro = c; pintar(); } }, NOMBRES[c] || c); }));
        var lista = cat.productos.filter(function (p) { return filtro === 'Todo' || p.categoria === filtro; });
        grid.replaceChildren.apply(grid, lista.length ? lista.map(tarjetaProducto) : [h('div', { class: 'empty', style: 'grid-column:1/-1' }, 'Pronto verás aquí los productos de La Banda.')]);
      }
      contador = h('span', { style: 'position:absolute;top:-2px;right:-2px;width:20px;height:20px;border-radius:10px;background:var(--red);color:#fff;font-size:11px;font-weight:700;align-items:center;justify-content:center' });
      pintar(); pintarContador();
      return h('div', { class: 'screen' }, h('div', { class: 'row between' }, h('h1', null, 'Tienda LB'),
        h('a', { href: '#/carrito', class: 'icon-btn', style: 'position:relative', 'aria-label': 'Ver carrito' }, icon('bag', 20), contador)), chips, grid);
    });
  }
  function carrito() {
    return catalogo().then(function (cat) {
      var cont = h('div', { class: 'col', style: 'gap:10px' });
      var entrega = 'recoger_sede';
      var sede = h('select', { class: 'input', id: 'sede' }, cat.sedes.map(function (s) { return h('option', { value: s.id_sede }, nombreBonito(s.nombre)); }));
      var dir = h('input', { class: 'input', id: 'dir', placeholder: 'Dirección completa y barrio' });
      var pago = h('select', { class: 'input', id: 'pago' }, [['nequi', 'Nequi'], ['pse', 'PSE'], ['tarjeta', 'Tarjeta'], ['efectivo', 'Efectivo']].map(function (x) { return h('option', { value: x[0] }, x[1]); }));
      var zonaEntrega = h('div', { class: 'col', style: 'gap:10px' });
      var totales = h('div', { class: 'col', style: 'gap:8px' });
      var btn = h('button', { class: 'btn' }, 'Hacer pedido');
      function items() { return S.cart.map(function (x) { return { x: x, p: porId(cat.productos, 'id_producto', x.id_producto) }; }).filter(function (r) { return r.p; }); }
      function pintar() {
        var it = items();
        cont.replaceChildren.apply(cont, it.length ? it.map(function (r) {
          return h('div', { class: 'card tight row' }, h('div', { class: 'photo', style: 'width:64px;height:64px;flex:none;font-size:10px;border-radius:12px' }, r.p.imagen_url ? h('img', { src: r.p.imagen_url, alt: '' }) : 'Foto'),
            h('div', { class: 'col grow', style: 'gap:2px' }, h('span', { class: 'strong', style: 'font-size:14px' }, r.p.nombre), h('span', { class: 'small muted' }, money(r.p.precio))),
            h('div', { class: 'row', style: 'gap:4px' }, h('button', { class: 'icon-btn', 'aria-label': 'Quitar uno', onClick: function () { r.x.cantidad--; if (r.x.cantidad < 1) S.cart.splice(S.cart.indexOf(r.x), 1); guardarCart(); pintar(); } }, '−'),
              h('span', { style: 'width:20px;text-align:center', class: 'strong' }, r.x.cantidad),
              h('button', { class: 'icon-btn', 'aria-label': 'Agregar uno', onClick: function () { r.x.cantidad = Math.min(20, r.x.cantidad + 1); guardarCart(); pintar(); } }, '+')));
        }) : [h('div', { class: 'empty' }, 'Tu carrito está vacío. ', h('a', { href: '#/tienda' }, 'Ir a la tienda'))]);
        var total = it.reduce(function (t, r) { return t + LB.num(r.p.precio) * r.x.cantidad; }, 0);
        totales.replaceChildren(filaDato('Total', money(total)), h('div', { class: 'row between small' }, h('span', { class: 'muted' }, 'Puntos a ganar al pagar'),
          h('span', { class: 'strong', style: 'color:var(--red-text)' }, '+' + Math.floor(total / 1000 * LB.PUNTOS_POR_MIL) + ' pts')));
        btn.disabled = !it.length;
        zonaEntrega.replaceChildren(h('div', { class: 'grid2' },
          h('button', { class: 'card tight' + (entrega === 'recoger_sede' ? ' hot' : ''), style: 'text-align:left;cursor:pointer;color:var(--text)', onClick: function () { entrega = 'recoger_sede'; pintar(); } }, h('span', { class: 'strong', style: 'display:block' }, 'Recoger en sede'), h('span', { class: 'small muted' }, 'Sin costo')),
          h('button', { class: 'card tight' + (entrega === 'domicilio' ? ' hot' : ''), style: 'text-align:left;cursor:pointer;color:var(--text)', onClick: function () { entrega = 'domicilio'; pintar(); } }, h('span', { class: 'strong', style: 'display:block' }, 'Domicilio'), h('span', { class: 'small muted' }, 'Costo según zona'))),
          entrega === 'recoger_sede' ? h('label', { class: 'field', for: 'sede' }, 'Sede donde recoges', sede) : h('label', { class: 'field', for: 'dir' }, 'Dirección de entrega', dir));
      }
      btn.addEventListener('click', function () {
        UI.accion(btn, api('comprar', { items: S.cart, entrega: entrega, id_sede: entrega === 'recoger_sede' ? sede.value : '', direccion: dir.value, metodo_pago: pago.value })).then(function (v) {
          S.cart = []; guardarCart();
          go('perfil');
          setTimeout(function () {
            UI.sheet('Pedido recibido', h('div', { class: 'col', style: 'gap:12px;line-height:1.5' }, h('p', { style: 'margin:0' }, 'Tu pedido por ' + money(v.total) + ' quedó registrado.'),
              h('p', { class: 'muted', style: 'margin:0' }, 'El pago en línea se activa cuando conectemos la pasarela de pagos. Por ahora pagas al recoger o contra entrega con el método que elegiste.')));
          }, 250);
        }).catch(function () {});
      });
      pintar();
      return h('div', { class: 'screen no-nav', style: 'padding-bottom:230px' }, top('tienda'), h('h1', null, 'Tu carrito'), cont,
        h('span', { class: 'eyebrow', style: 'color:var(--muted)' }, '¿Cómo lo recibes?'), zonaEntrega, h('label', { class: 'field', for: 'pago' }, 'Método de pago', pago),
        h('div', { class: 'bottom-bar' }, totales, btn));
    });
  }

  function perfil() {
    return api('misDatos').then(function (d) {
      var prox = d.citas.filter(function (c) { return (c.estado === 'confirmada' || c.estado === 'pendiente') && c.fecha >= d.hoy; });
      var pasadas = d.citas.filter(function (c) { return prox.indexOf(c) < 0; }).reverse();
      return h('div', { class: 'screen' },
        h('div', { class: 'row' }, h('span', { class: 'avatar' }, UI.iniciales(d.cliente.nombre)), h('div', { class: 'col', style: 'gap:2px' }, h('span', { class: 'strong', style: 'font-size:18px' }, d.cliente.nombre), h('span', { class: 'small muted' }, '+57 ' + d.cliente.celular))),
        h('div', { class: 'card', style: 'background:#000;border:2px solid var(--red);display:flex;flex-direction:column;gap:10px' },
          h('div', { class: 'row between' }, h('div', { class: 'col', style: 'gap:4px' }, h('span', { class: 'eyebrow' }, 'Puntos LB'), h('span', { class: 'display', style: 'font-size:46px' }, d.saldo)),
            h('img', { src: EMBLEMA, alt: '', width: 72, height: 72 })),
          h('span', { class: 'small muted' }, 'Sumas ' + LB.PUNTOS_POR_MIL + ' punto por cada $1.000 en citas atendidas y compras pagadas.')),
        h('h2', null, 'Próximas citas'),
        prox.length ? prox.map(function (c) {
          return h('div', { class: 'card tight row between' }, h('span', { class: 'col', style: 'gap:3px' }, h('span', { class: 'strong' }, UI.fechaCorta(c.fecha) + ' · ' + UI.hora12(c.hora_inicio)),
            h('span', { class: 'small muted' }, c.servicio_nombre + ' · ' + nombreBonito(c.barbero_nombre) + ' · ' + nombreBonito(c.sede_nombre))),
            h('button', { class: 'btn sm danger', onClick: function (e) {
              var b = e.currentTarget;
              UI.confirmar('Cancelar cita', '¿Seguro que quieres cancelar tu cita del ' + UI.fechaCorta(c.fecha) + ' a las ' + UI.hora12(c.hora_inicio) + '?', function () {
                UI.accion(b, api('cancelarCita', { id: c.id_cita }), 'Cita cancelada').then(render).catch(function () {});
              });
            } }, 'Cancelar'));
        }) : h('div', { class: 'empty' }, 'No tienes citas próximas. ', h('a', { href: '#/reservar/sede' }, 'Reservar ahora')),
        pasadas.length ? [h('h2', null, 'Historial'), h('div', { class: 'card list' }, pasadas.slice(0, 15).map(function (c) {
          return h('div', { class: 'row between' }, h('span', { class: 'col', style: 'gap:2px' }, h('span', { class: 'strong' }, c.servicio_nombre), h('span', { class: 'small muted' }, UI.fechaCorta(c.fecha) + ' · ' + nombreBonito(c.barbero_nombre))), badgeEstado(c.estado));
        }))] : null,
        d.ventas.length ? [h('h2', null, 'Mis pedidos'), h('div', { class: 'card list' }, d.ventas.slice().reverse().map(function (v) {
          return h('div', { class: 'row between' }, h('span', { class: 'col grow', style: 'gap:2px' }, h('span', { class: 'strong' }, money(v.total)), h('span', { class: 'small muted' }, v.items)), badgeEstado(v.estado));
        }))] : null,
        UI.botonInstalar('La Banda'),
        h('button', { class: 'btn ghost', onClick: function () { UI.confirmar('Cerrar sesión', 'Tendrás que escribir tu celular para volver a entrar.', salir); } }, 'Cerrar sesión'));
    });
  }

  // ---------- enrutador ----------
  var RUTAS = { inicio: [inicio, 'inicio'], 'reservar/sede': [pasoSede, 'reservar/sede'], 'reservar/servicio': [pasoServicio, 'reservar/sede'], 'reservar/barbero': [pasoBarbero, 'reservar/sede'],
    'reservar/horario': [pasoHorario, null], 'reservar/confirmar': [pasoConfirmar, null], 'reservar/listo': [listo, null], tienda: [tienda, 'tienda'], carrito: [carrito, null], perfil: [perfil, 'perfil'] };
  var root = document.getElementById('root'), turno = 0;
  function render() {
    var ruta = location.hash.replace(/^#\/?/, '') || 'inicio', mio = ++turno;
    var vista, activo = null;
    if (!S.session) { vista = bienvenida; }
    else if (/^barbero\//.test(ruta)) { vista = function () { return perfilBarbero(ruta.split('/')[1]); }; }
    else { var r = RUTAS[ruta] || RUTAS.inicio; vista = r[0]; activo = r[1]; }
    var banner = UI.envBanner(function () { ['session', 'cliente', 'draft', 'cart'].forEach(function (k) { set(pref + k, null); }); });
    var app = h('main', { class: 'app' }, h('div', { class: 'spinner', role: 'status', 'aria-label': 'Cargando' }));
    root.replaceChildren(); if (banner) root.appendChild(banner); root.appendChild(app);
    Promise.resolve().then(vista).then(function (el) {
      if (mio !== turno || !el) return;
      app.replaceChildren(el); if (activo && S.session) app.appendChild(nav(activo));
      window.scrollTo(0, 0);
    }).catch(function (e) {
      if (mio !== turno) return;
      app.replaceChildren(h('div', { class: 'screen' }, h('div', { class: 'empty' }, 'No pudimos cargar esta pantalla: ' + e.message),
        h('button', { class: 'btn ghost', onClick: render }, 'Reintentar')));
      if (S.session) app.appendChild(nav(activo || 'inicio'));
    });
  }
  window.addEventListener('hashchange', render);
  render();
  UI.registrarSW();
})();
