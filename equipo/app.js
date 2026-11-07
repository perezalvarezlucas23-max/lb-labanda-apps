/* App LB Equipo – barberos y administración (en computador funciona como panel web) */
(function () {
  'use strict';
  var h = UI.h, icon = UI.icon, money = UI.money;
  var EMBLEMA = '../shared/img/lb-emblema.png';

  function get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  var pref = 'lb_eq_' + LBApi.env + '_';
  var S = { session: get(pref + 'session'), u: get(pref + 'usuario'), fecha: null, adm: null, hoy: null };
  var esAdmin = function () { return S.u && S.u.rol === 'admin'; };

  function api(action, p) {
    return LBApi.call(action, Object.assign({ session: S.session }, p || {})).catch(function (e) {
      if (/sesión terminó/i.test(e.message)) salir();
      throw e;
    });
  }
  function hoy() { return S.hoy ? Promise.resolve(S.hoy) : LBApi.call('ping').then(function (r) { S.hoy = r.hora.slice(0, 10); return S.hoy; }); }
  function datosAdmin(desde, hasta, force) {
    var key = desde + '|' + hasta;
    if (S.adm && S.adm.key === key && !force) return Promise.resolve(S.adm.data);
    return api('adminData', { desde: desde, hasta: hasta }).then(function (d) { S.adm = { key: key, data: d }; return d; });
  }
  function invalidar() { S.adm = null; }
  function salir() { S.session = null; S.u = null; set(pref + 'session', null); set(pref + 'usuario', null); go(''); }
  function go(r) { if (location.hash === '#/' + r) render(); else location.hash = '#/' + r; }
  function limpio(n) { return String(n || '').replace(/^\[|\]$/g, ''); }
  function porId(l, col, id) { return (l || []).filter(function (x) { return x[col] === id; })[0]; }
  function lunes(f) { var p = f.split('-'), dow = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); return LB.sumarDias(f, dow === 0 ? -6 : 1 - dow); }
  function periodo(clave, hoyF) {
    if (clave === 'hoy') return { desde: hoyF, hasta: hoyF };
    if (clave === 'semana') return { desde: lunes(hoyF), hasta: hoyF };
    return { desde: hoyF.slice(0, 8) + '01', hasta: hoyF };
  }
  function kpi(t, v, hot) { return h('div', { class: 'kpi' + (hot ? ' hot' : '') }, h('span', null, t), h('b', null, v)); }
  function badgeEstado(e) {
    var m = { confirmada: ['warn', 'Por atender'], pendiente: ['warn', 'Pendiente'], completada: ['ok', 'Atendida'], cancelada: ['gray', 'Cancelada'], no_asistio: ['red', 'No asistió'],
      pagada: ['ok', 'Pagada'], entregada: ['gray', 'Entregada'] };
    var x = m[e] || ['gray', e]; return h('span', { class: 'badge ' + x[0] }, x[1]);
  }
  var ORIGEN = { app: 'App', whatsapp: 'WhatsApp', web: 'Web', presencial: 'Presencial' };
  var DIAS_N = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
  function encabezado(eyebrow, titulo, extra) {
    return h('div', { class: 'row between', style: 'align-items:flex-start' }, h('div', { class: 'col', style: 'gap:2px' }, h('span', { class: 'eyebrow' }, eyebrow), h('h1', null, titulo), extra || null),
      h('img', { src: EMBLEMA, alt: '', width: 48, height: 48 }));
  }

  // ---------- navegación ----------
  var MENU_BARBERO = [['agenda', 'cal', 'Agenda'], ['control', 'chart', 'Mi control'], ['horarios', 'clock', 'Horarios'], ['salir', 'out', 'Salir']];
  var MENU_ADMIN = [['resumen', 'chart', 'Resumen'], ['agendas', 'cal', 'Agendas'], ['barberos', 'users', 'Barberos'], ['servicios', 'scissors', 'Servicios'], ['mas', 'more', 'Más']];
  function nav(activo) {
    var m = esAdmin() ? MENU_ADMIN : MENU_BARBERO;
    return h('nav', { class: 'nav', 'aria-label': 'Menú' }, m.map(function (it) {
      return h('a', { href: '#/' + it[0], class: activo === it[0] ? 'on' : '', 'aria-current': activo === it[0] ? 'page' : null }, icon(it[1]), it[2]);
    }));
  }
  function lateral(activo) {
    var m = esAdmin() ? MENU_ADMIN.slice(0, 4).concat([['mas', 'store', 'Sedes, tienda y pedidos'], ['salir', 'out', 'Salir']]) : MENU_BARBERO;
    return h('aside', { class: 'side' }, h('div', { class: 'row', style: 'gap:12px' }, h('img', { src: EMBLEMA, alt: 'LB La Banda', width: 52, height: 52 }),
      h('div', { class: 'col', style: 'gap:0' }, h('span', { class: 'display', style: 'font-size:18px' }, 'La Banda'), h('span', { class: 'small muted' }, esAdmin() ? 'Administración' : 'Equipo'))),
      h('nav', { class: 'col', style: 'gap:4px' }, m.map(function (it) { return h('a', { href: '#/' + it[0], class: activo === it[0] ? 'on' : '' }, icon(it[1], 18), it[2]); })),
      h('span', { class: 'small muted', style: 'margin-top:auto' }, limpio(S.u.nombre)));
  }

  // ---------- ingreso ----------
  function login() {
    var cel = h('input', { class: 'input', id: 'cel', type: 'tel', inputmode: 'numeric', autocomplete: 'username', placeholder: '300 000 0000' });
    var pin = h('input', { class: 'input', id: 'pin', type: 'password', inputmode: 'numeric', autocomplete: 'current-password', placeholder: '••••' });
    var btn = h('button', { class: 'btn', type: 'submit' }, 'Entrar');
    return h('div', { class: 'screen no-nav', style: 'align-items:center;padding-top:56px;max-width:460px;margin:0 auto' },
      h('img', { src: EMBLEMA, alt: 'LB La Banda', width: 160, height: 160 }), h('h1', { style: 'font-size:36px;letter-spacing:2px' }, 'LB Equipo'),
      h('p', { class: 'muted center', style: 'margin:0' }, 'App para barberos y administración'),
      h('form', { class: 'col', style: 'gap:12px;width:100%;margin-top:12px', onSubmit: function (e) {
        e.preventDefault();
        UI.accion(btn, LBApi.call('loginEquipo', { celular: cel.value, pin: pin.value })).then(function (r) {
          S.session = r.session; S.u = r.usuario; set(pref + 'session', r.session); set(pref + 'usuario', r.usuario);
          go(r.usuario.rol === 'admin' ? 'resumen' : 'agenda');
        }).catch(function () {});
      } }, h('label', { class: 'field', for: 'cel' }, 'Celular', cel), h('label', { class: 'field', for: 'pin' }, 'Clave', pin), btn),
      h('p', { class: 'small muted center', style: 'line-height:1.5;margin:0' }, 'El administrador crea la cuenta y la clave de cada barbero. En su primer ingreso, el administrador crea su propia clave.'),
      UI.botonInstalar('LB Equipo'));
  }

  // ---------- agenda: historial · hoy · próximas ----------
  var tabAgenda = 'hoy', histDias = 30;
  function grupos(citas, desc) {
    var orden = citas.slice().sort(function (x, y) { return (x.fecha + x.hora_inicio) < (y.fecha + y.hora_inicio) ? -1 : 1; });
    if (desc) orden.reverse();
    var out = [], actual = null;
    orden.forEach(function (c) { if (!actual || actual.fecha !== c.fecha) { actual = { fecha: c.fecha, citas: [] }; out.push(actual); } actual.citas.push(c); });
    return out;
  }
  function comisionDe(c) {
    if (c.estado === 'completada') return LB.num(c.comision);
    if (c.estado === 'confirmada' || c.estado === 'pendiente') return LB.num(c.comision_estimada);
    return 0;
  }
  /** Una cita como la ve el equipo. El valor que paga el cliente solo aparece si el servidor lo envió (administrador). */
  function tarjetaCita(c, idBarbero, conAcciones) {
    var porAtender = c.estado === 'confirmada' || c.estado === 'pendiente';
    var com = comisionDe(c);
    var lineaCom = c.estado === 'completada' ? 'Comisión: ' + money(com) : porAtender ? 'Comisión estimada: ' + money(com) : null;
    return h('div', { class: 'row', style: 'align-items:stretch;gap:12px' },
      h('span', { class: 'small strong', style: 'width:64px;padding-top:14px;color:' + (porAtender ? 'var(--red-text)' : 'var(--muted)') }, UI.hora12(c.hora_inicio)),
      h('div', { class: 'card tight grow col', style: 'gap:8px' + (porAtender && conAcciones ? ';border-color:var(--red-line)' : '') },
        h('div', { class: 'row between' }, h('span', { class: 'col', style: 'gap:2px' }, h('span', { class: 'strong' }, limpio(c.cliente_nombre)),
          h('span', { class: 'small muted' }, c.servicio_nombre + ' · ' + (ORIGEN[c.origen] || c.origen) + (c.valor !== undefined ? ' · Valor ' + money(c.valor) : ''))), badgeEstado(c.estado)),
        lineaCom ? h('span', { class: 'small strong', style: 'color:var(--red-text)' }, lineaCom) : null,
        c.notas ? h('span', { class: 'small muted' }, 'Nota: ' + c.notas) : null,
        porAtender && conAcciones ? h('div', { class: 'grid2' },
          h('button', { class: 'btn sm', style: 'width:100%', onClick: function (e) { var bt = e.currentTarget; UI.accion(bt, api('marcarCita', { id: c.id_cita, estado: 'completada', id_barbero: idBarbero }), 'Marcada como atendida').then(function () { invalidar(); render(); }).catch(function () {}); } }, 'Marcar atendida'),
          h('button', { class: 'btn sm danger', style: 'width:100%', onClick: function (e) { var bt = e.currentTarget; UI.confirmar('No asistió', '¿Confirmas que ' + limpio(c.cliente_nombre) + ' no llegó a la cita?', function () { UI.accion(bt, api('marcarCita', { id: c.id_cita, estado: 'no_asistio', id_barbero: idBarbero }), 'Registrado').then(function () { invalidar(); render(); }).catch(function () {}); }); } }, 'No asistió')) : null));
  }
  function listaPorDia(gs, idBarbero, conAcciones, vacio) {
    if (!gs.length) return h('div', { class: 'empty' }, vacio);
    return h('div', { class: 'col', style: 'gap:16px' }, gs.map(function (g) {
      return h('div', { class: 'col', style: 'gap:10px' }, h('span', { class: 'eyebrow', style: 'color:var(--muted)' }, UI.fechaCorta(g.fecha)),
        g.citas.map(function (c) { return tarjetaCita(c, idBarbero, conAcciones); }));
    }));
  }
  function agenda(idBarbero) {
    return hoy().then(function (hoyF) {
      var fecha = S.fecha || hoyF;
      return api('miAgenda', { fecha: tabAgenda === 'hoy' ? fecha : hoyF, id_barbero: idBarbero }).then(function (d) {
        var b = d.barbero, activa = LB.si(b.agenda_activa);
        var sw = h('button', { class: 'switch', 'aria-pressed': activa ? 'true' : 'false', 'aria-label': 'Activar o pausar la agenda' });
        sw.addEventListener('click', function () {
          var nueva = sw.getAttribute('aria-pressed') !== 'true';
          UI.accion(null, api('setAgenda', { activa: nueva, id_barbero: idBarbero }), nueva ? 'Agenda activa: ya pueden reservar contigo' : 'Agenda pausada').then(function () { invalidar(); render(); }).catch(function () {});
        });
        var tabs = h('div', { class: 'grid3', role: 'tablist' }, [['historial', 'Historial'], ['hoy', 'Hoy'], ['proximas', 'Próximas']].map(function (x) {
          return h('button', { class: 'chip' + (tabAgenda === x[0] ? ' on' : ''), role: 'tab', 'aria-selected': tabAgenda === x[0] ? 'true' : 'false', onClick: function () { tabAgenda = x[0]; S.fecha = null; render(); } }, x[1]);
        }));
        var cabeza = [idBarbero ? null : encabezado('Mi agenda', limpio(b.nombre)),
          h('div', { class: 'card tight row between' }, h('span', { class: 'col', style: 'gap:3px' }, h('span', { class: 'strong' }, activa ? 'Agenda activa' : 'Agenda pausada'),
            h('span', { class: 'small muted' }, activa ? 'Los clientes pueden reservar contigo' : 'No recibes reservas nuevas. Las citas agendadas se mantienen.')), sw), tabs];
        function armar(cuerpo) { return h('div', { class: 'col', style: 'gap:16px' }, cabeza, cuerpo); }

        if (tabAgenda === 'hoy') {
          var atendidas = d.citas.filter(function (c) { return c.estado === 'completada'; });
          var ganado = d.citas.reduce(function (t, c) { return t + (c.estado === 'completada' ? comisionDe(c) : 0); }, 0);
          function cambiarDia(n) { S.fecha = LB.sumarDias(fecha, n); render(); }
          return armar(h('div', { class: 'col', style: 'gap:16px' },
            h('div', { class: 'row between' }, h('button', { class: 'icon-btn', 'aria-label': 'Día anterior', onClick: function () { cambiarDia(-1); } }, icon('chevL', 20)),
              h('div', { class: 'col center', style: 'gap:2px' }, h('span', { class: 'strong' }, (fecha === hoyF ? 'Hoy, ' : '') + UI.fechaCorta(fecha)),
                fecha !== hoyF ? h('button', { class: 'small', style: 'background:none;border:0;color:var(--red-text);cursor:pointer', onClick: function () { S.fecha = null; render(); } }, 'Volver a hoy') : null),
              h('button', { class: 'icon-btn', 'aria-label': 'Día siguiente', onClick: function () { cambiarDia(1); } }, icon('chevR', 20))),
            h('div', { class: 'grid3' }, kpi('Citas del día', d.citas.length), kpi('Atendidas', atendidas.length), kpi('Comisión ganada', money(ganado), true)),
            d.citas.length ? h('div', { class: 'col', style: 'gap:10px' }, d.citas.map(function (c) { return tarjetaCita(c, idBarbero, true); }))
              : h('div', { class: 'empty' }, 'No hay citas para este día.')));
        }
        if (tabAgenda === 'proximas') {
          return api('miControl', { desde: LB.sumarDias(hoyF, 1), hasta: LB.sumarDias(hoyF, 60), id_barbero: idBarbero }).then(function (r) {
            var prox = r.citas.filter(function (c) { return c.estado === 'confirmada' || c.estado === 'pendiente'; });
            var est = prox.reduce(function (t, c) { return t + comisionDe(c); }, 0);
            return armar(h('div', { class: 'col', style: 'gap:16px' },
              h('div', { class: 'grid2' }, kpi('Citas próximas', prox.length), kpi('Comisión estimada', money(est), true)),
              h('span', { class: 'small muted' }, 'Desde mañana hasta el ' + UI.fechaCorta(r.hasta)),
              listaPorDia(grupos(prox, false), idBarbero, false, 'No tienes citas programadas en los próximos días.')));
          });
        }
        return api('miControl', { desde: LB.sumarDias(hoyF, -histDias), hasta: LB.sumarDias(hoyF, -1), id_barbero: idBarbero }).then(function (r) {
          var comp = r.citas.filter(function (c) { return c.estado === 'completada'; });
          var ganado = comp.reduce(function (t, c) { return t + comisionDe(c); }, 0);
          var noVino = r.citas.filter(function (c) { return c.estado === 'no_asistio'; }).length;
          var dias = h('div', { class: 'chips' }, [[7, 'Últimos 7 días'], [30, '30 días'], [90, '90 días']].map(function (x) {
            return h('button', { class: 'chip' + (histDias === x[0] ? ' on' : ''), onClick: function () { histDias = x[0]; render(); } }, x[1]);
          }));
          return armar(h('div', { class: 'col', style: 'gap:16px' }, dias,
            h('div', { class: 'grid3' }, kpi('Atendidos', comp.length), kpi('Comisión ganada', money(ganado), true), kpi('No asistieron', noVino)),
            listaPorDia(grupos(r.citas, true), idBarbero, false, 'Sin servicios en este periodo.')));
        });
      });
    });
  }
  function vistaAgenda() { return agenda().then(function (el) { return h('div', { class: 'screen' }, el); }); }

  // ---------- mi control (servicios y comisión; el valor del cliente solo lo ve el administrador) ----------
  var periodoControl = 'semana';
  function control() {
    return hoy().then(function (hoyF) {
      var r = periodo(periodoControl, hoyF);
      return api('miControl', r).then(function (d) {
        var comp = d.citas.filter(function (c) { return c.estado === 'completada'; });
        var comision = comp.reduce(function (t, c) { return t + LB.num(c.comision); }, 0);
        var porAtender = d.citas.filter(function (c) { return c.estado === 'confirmada' || c.estado === 'pendiente'; }).length;
        var porServ = {};
        comp.forEach(function (c) { var x = porServ[c.id_servicio] || (porServ[c.id_servicio] = { n: 0, com: 0, valor: 0 }); x.n++; x.com += LB.num(c.comision); x.valor += LB.num(c.valor); });
        var chips = h('div', { class: 'grid3' }, [['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes']].map(function (x) {
          return h('button', { class: 'chip' + (periodoControl === x[0] ? ' on' : ''), 'aria-pressed': periodoControl === x[0] ? 'true' : 'false', onClick: function () { periodoControl = x[0]; render(); } }, x[1]);
        }));
        var ult = comp.slice().reverse().slice(0, 5);
        return h('div', { class: 'screen' }, encabezado(limpio(S.u.nombre), 'Mi control'), chips,
          h('span', { class: 'small muted' }, UI.fechaCorta(r.desde) + (r.hasta !== r.desde ? ' al ' + UI.fechaCorta(r.hasta) : '')),
          h('div', { class: 'grid2' }, kpi('Servicios atendidos', comp.length), kpi('Mi comisión', money(comision), true),
            kpi('Por atender', porAtender), kpi('No asistieron', d.citas.filter(function (c) { return c.estado === 'no_asistio'; }).length),
            d.conValor ? kpi('Total en servicios', money(comp.reduce(function (t, c) { return t + LB.num(c.valor); }, 0))) : null),
          h('h2', null, 'Por servicio'),
          h('div', { class: 'card list' }, d.servicios.map(function (s) {
            var x = porServ[s.id_servicio] || { n: 0, com: 0 };
            var prem = /premium/i.test(s.nombre);
            return h('div', { class: 'row between' }, h('span', { class: prem ? 'strong' : '', style: prem ? 'color:var(--red-text)' : '' }, s.nombre),
              h('span', { class: 'muted' }, x.n + ' · comisión ', h('span', { class: 'strong', style: 'color:var(--text)' }, money(x.com))));
          })),
          h('h2', null, 'Últimos atendidos'),
          ult.length ? h('div', { class: 'card list' }, ult.map(function (c) {
            return h('div', { class: 'row between' }, h('span', { class: 'col', style: 'gap:2px' }, h('span', { class: 'strong' }, limpio(c.cliente_nombre)), h('span', { class: 'small muted' }, c.servicio_nombre + ' · ' + UI.fechaCorta(c.fecha))),
              h('span', { class: 'col', style: 'gap:2px;text-align:right' }, h('span', { class: 'small muted' }, 'Comisión'), h('span', { class: 'strong' }, money(c.comision))));
          })) : h('div', { class: 'empty' }, 'Sin servicios atendidos en este periodo.'),
          h('a', { class: 'btn ghost', href: '#/agenda', onClick: function () { tabAgenda = 'historial'; } }, 'Ver historial completo'));
      });
    });
  }

  // ---------- horarios ----------
  function horarios(idBarbero) {
    return Promise.all([api('misHorarios', { id_barbero: idBarbero }), hoy()]).then(function (r) {
      var d = r[0], hoyF = r[1];
      var filas = d.dias.map(function (x) {
        var sw = h('button', { class: 'switch', 'aria-pressed': x.activo ? 'true' : 'false', 'aria-label': 'Trabajo el ' + DIAS_N[x.dia] });
        var ini = h('input', { class: 'input', type: 'time', value: x.hora_inicio || '09:00', 'aria-label': 'Entrada ' + DIAS_N[x.dia] });
        var fin = h('input', { class: 'input', type: 'time', value: x.hora_fin || '19:00', 'aria-label': 'Salida ' + DIAS_N[x.dia] });
        var dIni = h('input', { class: 'input', type: 'time', value: x.descanso_inicio, 'aria-label': 'Inicio descanso ' + DIAS_N[x.dia] });
        var dFin = h('input', { class: 'input', type: 'time', value: x.descanso_fin, 'aria-label': 'Fin descanso ' + DIAS_N[x.dia] });
        var horas = h('div', { class: 'col', style: 'gap:8px' }, h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Entrada', ini), h('label', { class: 'field' }, 'Salida', fin)),
          h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Descanso desde', dIni), h('label', { class: 'field' }, 'Descanso hasta', dFin)));
        function pintar() { horas.style.display = sw.getAttribute('aria-pressed') === 'true' ? 'flex' : 'none'; }
        sw.addEventListener('click', function () { sw.setAttribute('aria-pressed', sw.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); pintar(); });
        pintar();
        return { dia: x.dia, el: h('div', { class: 'col', style: 'gap:10px' }, h('div', { class: 'row between' }, h('span', { class: 'strong' }, DIAS_N[x.dia]), sw), horas),
          leer: function () { return { dia: x.dia, activo: sw.getAttribute('aria-pressed') === 'true', hora_inicio: ini.value, hora_fin: fin.value, descanso_inicio: dIni.value, descanso_fin: dFin.value }; } };
      });
      var guardar = h('button', { class: 'btn' }, 'Guardar horarios');
      guardar.addEventListener('click', function () { UI.accion(guardar, api('guardarHorario', { id_barbero: idBarbero, dias: filas.map(function (f) { return f.leer(); }) }), 'Horarios guardados').catch(function () {}); });
      var bf = h('input', { class: 'input', type: 'date', value: hoyF, min: hoyF, 'aria-label': 'Fecha del bloqueo' });
      var bi = h('input', { class: 'input', type: 'time', value: '13:00', 'aria-label': 'Desde' }), bfin = h('input', { class: 'input', type: 'time', value: '14:00', 'aria-label': 'Hasta' });
      var bm = h('input', { class: 'input', placeholder: 'Motivo (opcional)', 'aria-label': 'Motivo' });
      var bb = h('button', { class: 'btn ghost' }, 'Bloquear este horario');
      bb.addEventListener('click', function () { UI.accion(bb, api('bloquear', { id_barbero: idBarbero, fecha: bf.value, hora_inicio: bi.value, hora_fin: bfin.value, motivo: bm.value }), 'Horario bloqueado').then(render).catch(function () {}); });
      return h('div', { class: 'col', style: 'gap:16px' },
        h('span', { class: 'small muted' }, 'Los clientes solo ven los días y horas que actives.'),
        h('div', { class: 'card list' }, filas.map(function (f) { return f.el; })), guardar,
        h('h2', null, 'Bloquear un horario puntual'),
        h('div', { class: 'card col', style: 'gap:10px' }, h('label', { class: 'field' }, 'Fecha', bf), h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Desde', bi), h('label', { class: 'field' }, 'Hasta', bfin)), bm, bb),
        d.bloqueos.length ? h('div', { class: 'card list' }, d.bloqueos.map(function (b) {
          return h('div', { class: 'row between' }, h('span', null, UI.fechaCorta(b.fecha) + ' · ' + UI.hora12(b.hora_inicio) + ' – ' + UI.hora12(b.hora_fin)), h('span', { class: 'small muted' }, b.motivo || ''));
        })) : null);
    });
  }
  function vistaHorarios(id) {
    return horarios(id).then(function (el) {
      return h('div', { class: 'screen' }, id ? h('a', { class: 'small strong', href: '#/barberos/' + id }, '← Volver al barbero') : null, encabezado(id ? 'Horarios de ' + id : limpio(S.u.nombre), 'Mis horarios'), el);
    });
  }

  // ---------- administración ----------
  var F = { sede: 'Todas', barbero: 'Todos', periodo: 'mes', desde: null, hasta: null };
  function exportarCSV(citas) {
    var cols = ['fecha', 'hora_inicio', 'cliente_nombre', 'barbero_nombre', 'sede_nombre', 'servicio_nombre', 'valor', 'comision', 'origen', 'estado'];
    var txt = [cols.join(';')].concat(citas.map(function (c) { return cols.map(function (k) { return '"' + String(c[k] == null ? '' : c[k]).replace(/"/g, '""') + '"'; }).join(';'); })).join('\n');
    UI.descargar('atenciones-la-banda.csv', 'text/csv', '﻿' + txt);
  }
  function resumen() {
    return hoy().then(function (hoyF) {
      var r = F.periodo === 'rango' && F.desde && F.hasta ? { desde: F.desde, hasta: F.hasta } : periodo(F.periodo, hoyF);
      return datosAdmin(r.desde, r.hasta, true).then(function (d) {
        var res = LB.resumen(d.citas, d.ventas, F);
        var barberos = d.equipo.filter(function (u) { return u.atiende; });
        var citasF = d.citas.filter(function (c) { return (F.sede === 'Todas' || c.id_sede === F.sede) && (F.barbero === 'Todos' || c.id_barbero === F.barbero); });
        var selB = h('select', { class: 'input', id: 'fbarbero', onChange: function (e) { F.barbero = e.target.value; render(); } },
          h('option', { value: 'Todos' }, 'Todos los barberos'), barberos.map(function (b) { return h('option', { value: b.id, selected: F.barbero === b.id }, limpio(b.nombre)); }));
        var rango = F.periodo === 'rango' ? h('div', { class: 'grid2' },
          h('label', { class: 'field' }, 'Desde', h('input', { class: 'input', type: 'date', value: r.desde, onChange: function (e) { F.desde = e.target.value; render(); } })),
          h('label', { class: 'field' }, 'Hasta', h('input', { class: 'input', type: 'date', value: r.hasta, onChange: function (e) { F.hasta = e.target.value; render(); } }))) : null;
        function nombreB(id) { return limpio((porId(d.equipo, 'id', id) || {}).nombre || id); }
        function nombreS(id) { return limpio((porId(d.sedes, 'id_sede', id) || {}).nombre || id); }
        return h('div', { class: 'screen' }, encabezado('Solo administrador', 'Control general'),
          h('div', { class: 'card col', style: 'gap:12px' },
            h('div', { class: 'col', style: 'gap:6px' }, h('span', { class: 'small strong muted' }, 'Sede'), h('div', { class: 'chips' }, [['Todas', 'Todas']].concat(d.sedes.map(function (s) { return [s.id_sede, limpio(s.nombre)]; })).map(function (x) {
              return h('button', { class: 'chip' + (F.sede === x[0] ? ' on' : ''), 'aria-pressed': F.sede === x[0] ? 'true' : 'false', onClick: function () { F.sede = x[0]; render(); } }, x[1]);
            }))),
            h('label', { class: 'field', for: 'fbarbero' }, 'Barbero', selB),
            h('div', { class: 'col', style: 'gap:6px' }, h('span', { class: 'small strong muted' }, 'Periodo'), h('div', { class: 'chips' }, [['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['rango', 'Rango de fechas']].map(function (x) {
              return h('button', { class: 'chip' + (F.periodo === x[0] ? ' on' : ''), 'aria-pressed': F.periodo === x[0] ? 'true' : 'false', onClick: function () { F.periodo = x[0]; if (x[0] === 'rango') { F.desde = r.desde; F.hasta = r.hasta; } render(); } }, x[1]);
            }))), rango,
            h('span', { class: 'small muted' }, UI.fechaCorta(r.desde) + (r.hasta !== r.desde ? ' al ' + UI.fechaCorta(r.hasta) : ''))),
          h('div', { class: 'grid2', style: 'grid-template-columns:repeat(auto-fit,minmax(150px,1fr))' },
            kpi('Clientes atendidos', res.atendidos), kpi('Ingresos totales', money(res.ingresosTotales), true), kpi('Servicios', money(res.ingresosServicios)),
            kpi('Ventas tienda' + (F.barbero !== 'Todos' ? ' (todas)' : ''), money(res.ventasTienda)), kpi('Comisiones barberos', money(res.comisiones)),
            kpi('Utilidad tras comisiones', money(res.utilidad)), kpi('No asistieron', res.noAsistieron), kpi('Canceladas', res.canceladas)),
          h('h2', null, 'Por barbero' + (F.sede !== 'Todas' ? ' · ' + nombreS(F.sede) : '')),
          h('div', { class: 'card scroll-x', style: 'padding:4px 8px' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Barbero', 'Atendidos', 'Total', 'Comisión', 'No asistieron'].map(function (x) { return h('th', null, x); }))),
            h('tbody', null, barberos.map(function (b) { var x = res.porBarbero[b.id] || { atendidos: 0, total: 0, comision: 0, noAsistieron: 0 };
              return h('tr', null, h('td', { class: 'strong' }, limpio(b.nombre)), h('td', null, x.atendidos), h('td', null, money(x.total)), h('td', null, money(x.comision)), h('td', null, x.noAsistieron)); })))),
          h('h2', null, 'Por sede' + (F.barbero !== 'Todos' ? ' · ' + nombreB(F.barbero) : '')),
          h('div', { class: 'grid2' }, d.sedes.map(function (s) { var x = res.porSede[s.id_sede] || { atendidos: 0, total: 0 };
            return h('div', { class: 'card tight col' }, h('span', { class: 'strong' }, limpio(s.nombre)), h('span', { class: 'small muted' }, x.atendidos + ' atendidos'), h('span', { class: 'display', style: 'font-size:22px' }, money(x.total))); })),
          h('h2', null, 'Por servicio'),
          h('div', { class: 'card list' }, d.servicios.map(function (s) { var x = res.porServicio[s.id_servicio] || { atendidos: 0, total: 0 };
            return h('div', { class: 'row between' }, h('span', null, s.nombre), h('span', { class: 'muted' }, x.atendidos + ' · ', h('span', { class: 'strong', style: 'color:var(--text)' }, money(x.total)))); })),
          h('div', { class: 'row between wrap' }, h('h2', null, 'Detalle de atenciones'),
            h('button', { class: 'btn sm ghost', onClick: function () { exportarCSV(citasF); } }, icon('download', 16), 'Exportar a Excel (CSV)')),
          citasF.length ? h('div', { class: 'card scroll-x', style: 'padding:4px 8px' }, h('table', { class: 't' },
            h('thead', null, h('tr', null, ['Fecha', 'Hora', 'Cliente', 'Barbero', 'Sede', 'Servicio', 'Valor', 'Origen', 'Estado'].map(function (x) { return h('th', null, x); }))),
            h('tbody', null, citasF.slice().reverse().slice(0, 150).map(function (c) {
              return h('tr', null, h('td', null, UI.fechaCorta(c.fecha)), h('td', null, UI.hora12(c.hora_inicio)), h('td', null, limpio(c.cliente_nombre)), h('td', null, limpio(c.barbero_nombre)),
                h('td', null, limpio(c.sede_nombre)), h('td', null, c.servicio_nombre), h('td', null, money(c.valor)), h('td', null, ORIGEN[c.origen] || c.origen), h('td', null, badgeEstado(c.estado)));
            })))) : h('div', { class: 'empty' }, 'No hay atenciones con estos filtros.'));
      });
    });
  }

  var agendaDe = null;
  function agendas() {
    return hoy().then(function (hoyF) { return datosAdmin(hoyF, hoyF); }).then(function (d) {
      var barberos = d.equipo.filter(function (u) { return u.atiende; }).sort(function (x, y) { return x.id === S.u.id ? -1 : y.id === S.u.id ? 1 : 0; });
      if (!agendaDe || !porId(barberos, 'id', agendaDe)) agendaDe = (barberos[0] || {}).id;
      var chips = h('div', { class: 'chips' }, barberos.map(function (b) { return h('button', { class: 'chip' + (agendaDe === b.id ? ' on' : ''), onClick: function () { agendaDe = b.id; render(); } }, b.id === S.u.id ? 'Mi agenda' : limpio(b.nombre)); }));
      if (!agendaDe) return h('div', { class: 'screen' }, encabezado('Administración', 'Agendas'), h('div', { class: 'empty' }, 'Primero registra un barbero.'));
      return agenda(agendaDe).then(function (el) { return h('div', { class: 'screen' }, encabezado('Administración', 'Agendas'),
        h('span', { class: 'small muted', style: 'margin-top:-8px' }, 'Como administrador ves la agenda de cada barbero con el valor de cada servicio.'), chips, el); });
    });
  }

  function barberosV() {
    return hoy().then(function (hoyF) { return datosAdmin(hoyF, hoyF, true); }).then(function (d) {
      var barberos = d.equipo.filter(function (u) { return u.rol === 'barbero' || u.id === S.u.id; })
        .sort(function (x, y) { return x.rol === 'admin' ? -1 : y.rol === 'admin' ? 1 : 0; });
      return h('div', { class: 'screen' }, encabezado('Solo administrador', 'Barberos'),
        h('span', { class: 'small muted', style: 'margin-top:-8px' }, 'Cada barbero tiene su perfil, sede, comisión y clave de ingreso.'),
        barberos.map(function (b) {
          return h('div', { class: 'card tight row' }, h('span', { class: 'avatar' }, b.foto_url ? h('img', { src: b.foto_url, alt: '' }) : UI.iniciales(limpio(b.nombre))),
            h('span', { class: 'col grow', style: 'gap:3px' }, h('span', { class: 'strong' }, limpio(b.nombre)),
              h('span', { class: 'small muted' }, (String(b.id_sede || '').split(',').filter(Boolean).map(function (s) { return limpio((porId(d.sedes, 'id_sede', s) || {}).nombre || s); }).join(' · ') || 'Sin sede') + ' · Comisión ' + (b.comision_pct === '' ? '—' : b.comision_pct + '%')),
              h('span', { class: 'row wrap', style: 'gap:6px' }, b.rol === 'admin' ? h('span', { class: 'badge red' }, b.atiende ? 'Administrador · también atiende' : 'Administrador') : null,
                b.atiende ? (b.agenda_activa ? h('span', { class: 'badge ok' }, 'Agenda activa') : h('span', { class: 'badge gray' }, 'Agenda pausada')) : null,
                b.tiene_clave ? null : h('span', { class: 'badge warn' }, 'Sin clave'))),
            h('a', { class: 'btn sm ghost', href: '#/barberos/' + b.id }, 'Editar'));
        }),
        h('a', { class: 'btn', href: '#/barberos/nuevo' }, '+ Registrar barbero'));
    });
  }

  function barberoForm(id) {
    return hoy().then(function (hoyF) { return datosAdmin(hoyF, hoyF); }).then(function (d) {
      var nuevo = id === 'nuevo', b = nuevo ? { agenda_activa: true, servicios: d.servicios.map(function (s) { return s.id_servicio; }).join(',') } : porId(d.equipo, 'id', id);
      if (!b) return h('div', { class: 'screen' }, h('div', { class: 'empty' }, 'Barbero no encontrado.'));
      function campo(lbl, el) { return h('label', { class: 'field' }, lbl, el); }
      var nombre = h('input', { class: 'input', value: b.nombre || '', placeholder: 'Nombre y apellido' });
      var cel = h('input', { class: 'input', type: 'tel', inputmode: 'numeric', value: b.celular || '', placeholder: '300 000 0000' });
      var sedeOpts = d.sedes.map(function (s) { return [s.id_sede, limpio(s.nombre)]; }).concat(d.sedes.length > 1 ? [[d.sedes.map(function (s) { return s.id_sede; }).join(','), 'Todas las sedes']] : []);
      var sede = h('select', { class: 'input' }, sedeOpts.map(function (x) { return h('option', { value: x[0], selected: String(b.id_sede) === x[0] }, x[1]); }));
      var com = h('input', { class: 'input', inputmode: 'numeric', value: b.comision_pct === undefined ? '' : b.comision_pct, placeholder: 'Ej. 40' });
      var esp = h('input', { class: 'input', value: b.especialidades || '', placeholder: 'Ej. fade, barba, diseños (separadas por coma)' });
      var foto = h('input', { class: 'input', value: b.foto_url || '', placeholder: 'Enlace de la foto (opcional)' });
      var pin = h('input', { class: 'input', type: 'password', inputmode: 'numeric', placeholder: nuevo ? '4 a 8 números' : 'Déjalo vacío para no cambiarla' });
      var ofrece = String(b.servicios || '').split(',').filter(Boolean);
      var checks = d.servicios.map(function (s) { var c = h('input', { type: 'checkbox', checked: !ofrece.length || ofrece.indexOf(s.id_servicio) >= 0 }); return { id: s.id_servicio, c: c, el: h('label', { class: 'check' }, c, s.nombre) }; });
      var activa = h('input', { type: 'checkbox', checked: LB.si(b.agenda_activa) });
      var esAdm = b.rol === 'admin';
      var atiendeCk = h('input', { type: 'checkbox', checked: !esAdm || !!b.atiende });
      var zonaServicios = h('div', { class: 'col', style: 'gap:10px' });
      function pintarServ() { zonaServicios.style.display = atiendeCk.checked ? 'flex' : 'none'; }
      atiendeCk.addEventListener('change', pintarServ);
      var btn = h('button', { class: 'btn' }, nuevo ? 'Guardar barbero' : 'Guardar cambios');
      btn.addEventListener('click', function () {
        if (nuevo && !pin.value) { UI.toast('Asigna una clave para que el barbero pueda entrar', true); return; }
        var row = { nombre: nombre.value.trim(), celular: cel.value, id_sede: sede.value, comision_pct: com.value, especialidades: esp.value.trim(), foto_url: foto.value.trim(),
          servicios: atiendeCk.checked ? checks.filter(function (x) { return x.c.checked; }).map(function (x) { return x.id; }).join(',') : '', agenda_activa: atiendeCk.checked && activa.checked };
        if (atiendeCk.checked && !row.servicios) { UI.toast('Elige al menos un servicio', true); return; }
        if (!nuevo) row.id = b.id;
        UI.accion(btn, api('guardarBarbero', { row: row, pin: pin.value || undefined }), nuevo ? 'Barbero registrado' : 'Cambios guardados').then(function () { invalidar(); go('barberos'); }).catch(function () {});
      });
      return h('div', { class: 'screen' }, h('a', { class: 'small strong', href: '#/barberos' }, '← Barberos'), encabezado('Solo administrador', nuevo ? 'Registrar barbero' : esAdm ? 'Mi perfil' : 'Editar barbero'),
        h('div', { class: 'card col', style: 'gap:12px' }, campo('Nombre completo', nombre), campo('Celular (será su usuario)', cel),
          h('div', { class: 'grid2' }, campo('Sede', sede), campo('Comisión (%)', com)), campo('Especialidades (las ve el cliente)', esp), campo('Foto', foto),
          campo(nuevo ? 'Clave de ingreso' : 'Nueva clave', pin)),
        esAdm ? h('label', { class: 'check' }, atiendeCk, 'También atiendo clientes (tengo mi propia agenda)') : null,
        (zonaServicios.append(h('span', { class: 'eyebrow', style: 'color:var(--muted)' }, 'Servicios que realiza'), h('div', { class: 'grid2' }, checks.map(function (x) { return x.el; })),
          h('label', { class: 'check' }, activa, 'Agenda activa (recibe reservas)')), pintarServ(), zonaServicios),
        !nuevo && (!esAdm || b.atiende) ? h('a', { class: 'btn ghost', href: '#/horarios/' + b.id }, esAdm ? 'Ver y editar mis horarios' : 'Ver y editar sus horarios') : null, btn);
    });
  }

  function serviciosV() {
    return hoy().then(function (hoyF) { return datosAdmin(hoyF, hoyF, true); }).then(function (d) {
      function tarjeta(s) {
        var nuevo = !s.id_servicio;
        var nombre = h('input', { class: 'input', value: s.nombre || '', placeholder: 'Nombre del servicio', 'aria-label': 'Nombre' });
        var precio = h('input', { class: 'input', inputmode: 'numeric', value: s.precio === undefined ? '' : s.precio, placeholder: '$ precio', 'aria-label': 'Precio' });
        var dur = h('input', { class: 'input', inputmode: 'numeric', value: s.duracion_min === undefined ? '' : s.duracion_min, placeholder: 'minutos', 'aria-label': 'Duración' });
        var activo = h('input', { type: 'checkbox', checked: nuevo || LB.si(s.activo) });
        var btn = h('button', { class: nuevo ? 'btn' : 'btn sm', style: nuevo ? '' : 'width:100%' }, nuevo ? 'Agregar servicio' : 'Guardar');
        btn.addEventListener('click', function () {
          var row = { nombre: nombre.value.trim(), precio: precio.value, duracion_min: dur.value, activo: activo.checked };
          if (!nuevo) row.id_servicio = s.id_servicio; else row.orden = d.servicios.length + 1;
          UI.accion(btn, api('guardarServicio', { row: row }), 'Servicio guardado').then(function () { invalidar(); render(); }).catch(function () {});
        });
        return h('div', { class: 'card col' + (/premium/i.test(s.nombre || '') ? ' hot' : ''), style: 'gap:10px' }, h('label', { class: 'field' }, nuevo ? 'Nuevo servicio' : 'Servicio', nombre),
          h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Precio (COP)', precio), h('label', { class: 'field' }, 'Duración (min)', dur)),
          h('div', { class: 'row between' }, h('label', { class: 'check', style: 'border:0;padding:0' }, activo, 'Visible para clientes'), nuevo ? null : h('div', { style: 'width:120px' }, btn)), nuevo ? btn : null);
      }
      return h('div', { class: 'screen' }, encabezado('Solo administrador', 'Servicios y precios'),
        h('span', { class: 'small muted', style: 'margin-top:-8px' }, 'Lo que guardes aquí es lo que ven los clientes al reservar.'),
        d.servicios.map(tarjeta), tarjeta({}));
    });
  }

  function mas() {
    return hoy().then(function (hoyF) { return datosAdmin(LB.sumarDias(hoyF, -60), hoyF, true); }).then(function (d) {
      function input(v, ph, extra) { return h('input', Object.assign({ class: 'input', value: v == null ? '' : v, placeholder: ph, 'aria-label': ph }, extra || {})); }
      var sedes = d.sedes.map(function (s) {
        var f = { nombre: input(s.nombre, 'Nombre'), direccion: input(s.direccion, 'Dirección'), ciudad: input(s.ciudad, 'Ciudad'), telefono: input(s.telefono, 'Teléfono'),
          horario_apertura: input(s.horario_apertura, 'Abre', { type: 'time' }), horario_cierre: input(s.horario_cierre, 'Cierra', { type: 'time' }) };
        var act = h('input', { type: 'checkbox', checked: LB.si(s.activa) });
        var b = h('button', { class: 'btn sm' }, 'Guardar sede');
        b.addEventListener('click', function () { var row = { id_sede: s.id_sede, activa: act.checked }; Object.keys(f).forEach(function (k) { row[k] = f[k].value; }); UI.accion(b, api('guardarSede', { row: row }), 'Sede guardada').then(invalidar).catch(function () {}); });
        return h('div', { class: 'card col', style: 'gap:10px' }, h('span', { class: 'eyebrow' }, s.id_sede), f.nombre, f.direccion, h('div', { class: 'grid2' }, f.ciudad, f.telefono),
          h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Abre', f.horario_apertura), h('label', { class: 'field' }, 'Cierra', f.horario_cierre)),
          h('div', { class: 'row between' }, h('label', { class: 'check', style: 'border:0;padding:0' }, act, 'Sede activa'), b));
      });
      function formProducto(p) {
        var nuevo = !p.id_producto;
        var nombre = input(p.nombre, 'Nombre del producto'), precio = input(p.precio, 'Precio', { inputmode: 'numeric' }), img = input(p.imagen_url, 'Enlace de la foto (opcional)');
        var cat = h('select', { class: 'input', 'aria-label': 'Categoría' }, [['ropa', 'Ropa'], ['accesorios', 'Accesorios'], ['grooming', 'Barba y cabello'], ['merch', 'Merch']].map(function (x) { return h('option', { value: x[0], selected: p.categoria === x[0] }, x[1]); }));
        var act = h('input', { type: 'checkbox', checked: nuevo || LB.si(p.activo) });
        var b = h('button', { class: nuevo ? 'btn' : 'btn sm' }, nuevo ? 'Agregar producto' : 'Guardar');
        b.addEventListener('click', function () {
          var row = { nombre: nombre.value, precio: precio.value, imagen_url: img.value, categoria: cat.value, activo: act.checked };
          if (!nuevo) row.id_producto = p.id_producto;
          UI.accion(b, api('guardarProducto', { row: row }), 'Producto guardado').then(function () { invalidar(); if (nuevo) render(); }).catch(function () {});
        });
        return h('div', { class: 'card col', style: 'gap:10px' }, nombre, h('div', { class: 'grid2' }, precio, cat), img,
          h('div', { class: 'row between' }, h('label', { class: 'check', style: 'border:0;padding:0' }, act, 'Visible en la tienda'), nuevo ? null : b), nuevo ? b : null);
      }
      var pedidos = d.ventas.slice().reverse().map(function (v) {
        var sel = h('select', { class: 'input', style: 'width:auto', 'aria-label': 'Estado del pedido' }, [['pendiente', 'Pendiente'], ['pagada', 'Pagada'], ['entregada', 'Entregada'], ['cancelada', 'Cancelada']].map(function (x) { return h('option', { value: x[0], selected: v.estado === x[0] }, x[1]); }));
        sel.addEventListener('change', function () { UI.accion(null, api('marcarVenta', { id: v.id_venta, estado: sel.value }), 'Pedido actualizado').then(function (r) { if (r.puntos) UI.toast('Pedido pagado: +' + r.puntos + ' puntos para el cliente'); invalidar(); }).catch(function () {}); });
        return h('div', { class: 'row between wrap' }, h('span', { class: 'col grow', style: 'gap:2px' }, h('span', { class: 'strong' }, money(v.total) + ' · ' + limpio(v.cliente_nombre)),
          h('span', { class: 'small muted' }, UI.fechaCorta(v.fecha) + ' · ' + (v.entrega === 'domicilio' ? 'Domicilio' : 'Recoge en sede') + ' · ' + v.metodo_pago), h('span', { class: 'small muted' }, v.items)), sel);
      });
      return h('div', { class: 'screen' }, encabezado('Solo administrador', 'Sedes, tienda y pedidos'),
        h('h2', null, 'Pedidos de la tienda (60 días)'), pedidos.length ? h('div', { class: 'card list' }, pedidos) : h('div', { class: 'empty' }, 'Aún no hay pedidos.'),
        h('h2', null, 'Productos'), d.productos.map(formProducto), formProducto({}),
        h('h2', null, 'Sedes'), sedes,
        h('button', { class: 'btn ghost', onClick: function () { UI.confirmar('Cerrar sesión', '¿Salir de LB Equipo en este dispositivo?', salir); } }, 'Cerrar sesión'));
    });
  }

  // ---------- enrutador ----------
  var root = document.getElementById('root'), turno = 0;
  function render() {
    var ruta = location.hash.replace(/^#\/?/, ''), mio = ++turno, vista, activo;
    document.body.classList.toggle('wide', !!esAdmin());
    if (!S.session || !S.u) { vista = login; activo = null; }
    else if (ruta === 'salir') { history.back(); setTimeout(function () { UI.confirmar('Cerrar sesión', '¿Salir de LB Equipo en este dispositivo?', salir); }, 250); return; }
    else if (esAdmin()) {
      var p = ruta.split('/');
      if (p[0] === 'barberos' && p[1]) { vista = function () { return barberoForm(p[1]); }; activo = 'barberos'; }
      else if (p[0] === 'horarios' && p[1]) { vista = function () { return vistaHorarios(p[1]); }; activo = 'barberos'; }
      else { var A = { resumen: resumen, agendas: agendas, barberos: barberosV, servicios: serviciosV, mas: mas }; activo = A[p[0]] ? p[0] : 'resumen'; vista = A[activo]; }
    } else {
      var B = { agenda: vistaAgenda, control: control, horarios: function () { return vistaHorarios(); } }; activo = B[ruta] ? ruta : 'agenda'; vista = B[activo];
    }
    var banner = UI.envBanner(function () { set(pref + 'session', null); set(pref + 'usuario', null); });
    var main = h('main', { class: 'grow', style: 'min-width:0' }, h('div', { class: 'spinner', role: 'status', 'aria-label': 'Cargando' }));
    var app = h('div', { class: 'app' }, S.session ? lateral(activo) : null, main);
    root.replaceChildren(); if (banner) root.appendChild(banner); root.appendChild(app);
    Promise.resolve().then(vista).then(function (el) {
      if (mio !== turno || !el) return;
      main.replaceChildren(el); if (S.session) main.appendChild(nav(activo));
    }).catch(function (e) {
      if (mio !== turno) return;
      main.replaceChildren(h('div', { class: 'screen' }, h('div', { class: 'empty' }, 'No pudimos cargar esta pantalla: ' + e.message), h('button', { class: 'btn ghost', onClick: render }, 'Reintentar')));
      if (S.session) main.appendChild(nav(activo));
    });
  }
  window.addEventListener('hashchange', render);
  render();
  UI.registrarSW();
})();
