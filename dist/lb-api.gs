/**
 * LB La Banda – API para Google Sheets. Archivo generado: no editar a mano.
 * Fuente: shared/logic.js + server/gs-adapter.js · Generado: 2026-11-07
 */
/*
 * LB La Banda – lógica de negocio compartida.
 * El mismo archivo corre en: el navegador (ambiente QA), las pruebas (Node) y Google Apps Script (STAGING/PROD).
 * No usar módulos ni APIs propias de un entorno: todo lo externo llega por `db` y `env`.
 */
var LB = (function () {
  'use strict';

  var PUNTOS_POR_MIL = 1;   // puntos LB por cada $1.000 pagados (ajustable)
  var PASO_MIN = 30;        // cada cuánto se ofrecen horas en la agenda
  var SESION_SEG = 6 * 3600;
  var DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  var ACTIVAS = ['pendiente', 'confirmada'];

  // ---------- utilidades ----------
  var K = [], H0 = [];
  (function () {
    var n = 2, c = 0, w = 4294967296;
    while (c < 64) {
      var primo = true;
      for (var d = 2; d * d <= n; d++) if (n % d === 0) { primo = false; break; }
      if (primo) {
        if (c < 8) H0[c] = (Math.pow(n, 1 / 2) * w) | 0;
        K[c++] = (Math.pow(n, 1 / 3) * w) | 0;
      }
      n++;
    }
  })();

  function sha256(str) {
    var msg = unescape(encodeURIComponent(String(str))), l = msg.length, i, j;
    var words = [], nW = (((l + 8) >> 6) + 1) * 16, H = H0.slice(), w = new Array(64);
    for (i = 0; i < nW; i++) words[i] = 0;
    for (i = 0; i < l; i++) words[i >> 2] |= msg.charCodeAt(i) << (24 - (i % 4) * 8);
    words[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
    words[nW - 1] = l * 8;
    for (j = 0; j < nW; j += 16) {
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        if (i < 16) w[i] = words[j + i] | 0;
        else {
          var x = w[i - 15], y = w[i - 2];
          var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
          var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (v) { return ('00000000' + (v >>> 0).toString(16)).slice(-8); }).join('');
  }

  function celular(v) {
    var s = String(v == null ? '' : v).replace(/\D/g, '');
    if (s.length === 12 && s.indexOf('57') === 0) s = s.slice(2);
    return s;
  }
  function hashPin(cel, pin) { return sha256('lb|' + celular(cel) + '|' + String(pin)); }
  function aMin(h) { var p = String(h || '').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function aHora(m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
  function cruza(a1, a2, b1, b2) { return aMin(a1) < aMin(b2) && aMin(b1) < aMin(a2); }
  function si(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/[^\d.-]/g, '')); return isFinite(n) ? n : 0; }
  function diaDe(fecha) {
    var p = String(fecha).split('-');
    return DIAS[new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()];
  }
  function sumarDias(fecha, n) {
    var p = String(fecha).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.toISOString().slice(0, 10);
  }
  function esFecha(f) { return /^\d{4}-\d{2}-\d{2}$/.test(String(f)); }
  function esHora(h) { return /^\d{2}:\d{2}$/.test(String(h)); }
  function sedesDe(b) { return String(b.id_sede || '').split(',').map(function (s) { return s.trim(); }).filter(String); }
  function serviciosDe(b) { return String(b.servicios || '').split(',').map(function (s) { return s.trim(); }).filter(String); }
  /** Atiende clientes: todo barbero, y el administrador cuando tiene servicios asignados. */
  function atiende(u) { return u.rol === 'barbero' || (u.rol === 'admin' && serviciosDe(u).length > 0); }
  function fail(msg) { var e = new Error(msg); e.lb = true; throw e; }
  function copia(o) { var r = {}; for (var k in o) if (k !== '_row' && k !== 'clave_hash') r[k] = o[k]; return r; }
  function porId(rows, col) { var m = {}; rows.forEach(function (r) { m[String(r[col])] = r; }); return m; }

  /** Horas de inicio libres para una duración dada, dentro del turno y sin cruzar ocupados. */
  function slotsLibres(turno, ocupados, duracion, desdeHora) {
    if (!turno || !si(turno.activo) || !esHora(turno.hora_inicio) || !esHora(turno.hora_fin)) return [];
    var bloqueos = ocupados.slice();
    if (esHora(turno.descanso_inicio) && esHora(turno.descanso_fin)) bloqueos.push({ hora_inicio: turno.descanso_inicio, hora_fin: turno.descanso_fin });
    var out = [], fin = aMin(turno.hora_fin), dur = Math.max(5, num(duracion) || PASO_MIN);
    for (var m = aMin(turno.hora_inicio); m + dur <= fin; m += PASO_MIN) {
      var ini = aHora(m), f = aHora(m + dur);
      if (desdeHora && m <= aMin(desdeHora)) continue;
      if (!bloqueos.some(function (o) { return cruza(ini, f, o.hora_inicio, o.hora_fin); })) out.push(ini);
    }
    return out;
  }

  /** Totales para los tableros. citas/ventas ya vienen filtradas por fecha. f = {sede, barbero}. */
  function resumen(citas, ventas, f) {
    f = f || {};
    var okSede = function (s) { return !f.sede || f.sede === 'Todas' || s === f.sede; };
    var okBarb = function (b) { return !f.barbero || f.barbero === 'Todos' || b === f.barbero; };
    var r = { atendidos: 0, ingresosServicios: 0, comisiones: 0, noAsistieron: 0, canceladas: 0, ventasTienda: 0,
      porBarbero: {}, porSede: {}, porServicio: {} };
    function acc(map, k) { return map[k] || (map[k] = { atendidos: 0, total: 0, comision: 0, noAsistieron: 0 }); }
    (citas || []).forEach(function (c) {
      var est = c.estado;
      if (okSede(c.id_sede) && okBarb(c.id_barbero)) {
        if (est === 'completada') { r.atendidos++; r.ingresosServicios += num(c.valor); r.comisiones += num(c.comision); }
        if (est === 'no_asistio') r.noAsistieron++;
        if (est === 'cancelada') r.canceladas++;
        if (est === 'completada') { var s = acc(r.porServicio, c.id_servicio); s.atendidos++; s.total += num(c.valor); }
      }
      if (okSede(c.id_sede)) {
        var b = acc(r.porBarbero, c.id_barbero);
        if (est === 'completada') { b.atendidos++; b.total += num(c.valor); b.comision += num(c.comision); }
        if (est === 'no_asistio') b.noAsistieron++;
      }
      if (okBarb(c.id_barbero)) {
        var sd = acc(r.porSede, c.id_sede);
        if (est === 'completada') { sd.atendidos++; sd.total += num(c.valor); sd.comision += num(c.comision); }
        if (est === 'no_asistio') sd.noAsistieron++;
      }
    });
    (ventas || []).forEach(function (v) {
      if (okSede(v.id_sede) && (v.estado === 'pagada' || v.estado === 'entregada')) r.ventasTienda += num(v.total);
    });
    r.ingresosTotales = r.ingresosServicios + r.ventasTienda;
    r.utilidad = r.ingresosTotales - r.comisiones;
    return r;
  }

  // ---------- servidor ----------
  /**
   * db:  list(tabla) -> filas con _row · insert(tabla, fila) · update(tabla, _row, cambios)
   * env: token, now() -> {fecha, hora, stamp} (hora Colombia) · sessions {get(k), put(k, v, seg)}
   *      newKey() -> texto aleatorio · lock(fn) -> ejecuta fn en exclusión
   */
  function createServer(db, env) {
    var ahora = function () { return env.now(); };
    var contador = 0;
    function uid(prefijo) {
      var n = ahora();
      contador = (contador + 1) % 1000;
      return prefijo + n.fecha.replace(/-/g, '').slice(2) + n.hora.replace(':', '') + ('00' + contador).slice(-3) +
        String(Math.floor(Math.random() * 90 + 10));
    }
    function secuencial(prefijo, filas, col) {
      var max = 0;
      filas.forEach(function (r) { var m = String(r[col]).match(new RegExp('^' + prefijo + '(\\d+)$')); if (m) max = Math.max(max, +m[1]); });
      return prefijo + (max + 1);
    }

    function equipo() { return db.list('Equipo'); }
    function barbero(id) {
      var b = equipo().filter(function (r) { return r.id === id && atiende(r); })[0];
      if (!b) fail('Barbero no encontrado');
      return b;
    }
    function servicio(id) {
      var s = db.list('Servicios').filter(function (r) { return r.id_servicio === id; })[0];
      if (!s || !si(s.activo)) fail('Servicio no disponible');
      return s;
    }
    function nombres() {
      return {
        eq: porId(equipo(), 'id'), sv: porId(db.list('Servicios'), 'id_servicio'),
        sd: porId(db.list('Sedes'), 'id_sede'), cl: porId(db.list('Clientes'), 'id_cliente')
      };
    }
    function enriquecer(c, n) {
      var o = copia(c);
      o.barbero_nombre = (n.eq[c.id_barbero] || {}).nombre || c.id_barbero;
      o.servicio_nombre = (n.sv[c.id_servicio] || {}).nombre || c.id_servicio;
      o.sede_nombre = (n.sd[c.id_sede] || {}).nombre || c.id_sede;
      o.cliente_nombre = (n.cl[c.id_cliente] || {}).nombre || c.id_cliente;
      return o;
    }
    function ordenCitas(a, b) { return (a.fecha + a.hora_inicio) < (b.fecha + b.hora_inicio) ? -1 : 1; }
    function rango(p) {
      var hoy = ahora().fecha;
      var desde = esFecha(p.desde) ? p.desde : hoy, hasta = esFecha(p.hasta) ? p.hasta : desde;
      if (hasta < desde) fail('El rango de fechas no es válido');
      return { desde: desde, hasta: hasta };
    }
    function enRango(r, x) { return x.fecha >= r.desde && x.fecha <= r.hasta; }

    function ocupadosDe(idBarbero, fecha, excepto) {
      var citas = db.list('Citas').filter(function (c) {
        return c.id_barbero === idBarbero && c.fecha === fecha && ACTIVAS.indexOf(c.estado) >= 0 && c.id_cita !== excepto;
      });
      var bloq = db.list('Bloqueos').filter(function (b) { return b.id_barbero === idBarbero && b.fecha === fecha; });
      return citas.concat(bloq);
    }
    function horasLibres(idBarbero, fecha, duracion) {
      var b = barbero(idBarbero), n = ahora();
      if (!si(b.agenda_activa) || !esFecha(fecha) || fecha < n.fecha) return { activa: si(b.agenda_activa), slots: [] };
      var dia = diaDe(fecha);
      var turno = db.list('Horarios').filter(function (h) { return h.id_barbero === idBarbero && h.dia === dia; })[0];
      return { activa: true, slots: slotsLibres(turno, ocupadosDe(idBarbero, fecha), duracion, fecha === n.fecha ? n.hora : null) };
    }
    function sumarPuntos(idCliente, tipo, ref, valor) {
      var pts = Math.floor(num(valor) / 1000 * PUNTOS_POR_MIL);
      if (pts <= 0) return 0;
      db.insert('Puntos', { id_mov: uid('PT'), fecha: ahora().fecha, id_cliente: idCliente, tipo: tipo, referencia: ref, puntos: pts });
      var cli = db.list('Clientes').filter(function (c) { return c.id_cliente === idCliente; })[0];
      if (cli) db.update('Clientes', cli._row, { puntos_saldo: num(cli.puntos_saldo) + pts });
      return pts;
    }
    function nuevaSesion(datos) { var k = env.newKey(); env.sessions.put(k, datos, SESION_SEG); return k; }

    // ----- acciones públicas -----
    var publicas = {
      ping: function () { return { ok: true, hora: ahora().stamp }; },
      catalogo: function () {
        return {
          sedes: db.list('Sedes').filter(function (s) { return si(s.activa); }).map(copia),
          servicios: db.list('Servicios').filter(function (s) { return si(s.activo); })
            .sort(function (a, b) { return num(a.orden) - num(b.orden); }).map(copia),
          barberos: equipo().filter(atiende).map(function (b) {
            return { id: b.id, nombre: b.nombre, id_sede: b.id_sede, especialidades: b.especialidades,
              servicios: b.servicios, foto_url: b.foto_url, agenda_activa: si(b.agenda_activa) };
          }),
          productos: db.list('Productos').filter(function (p) { return si(p.activo); }).map(copia),
          hoy: ahora().fecha
        };
      },
      disponibilidad: function (p) {
        var s = servicio(p.id_servicio);
        return horasLibres(p.id_barbero, p.fecha, s.duracion_min);
      },
      loginCliente: function (p) {
        var cel = celular(p.celular);
        if (cel.length < 10) fail('Escribe un celular válido de 10 dígitos');
        var c = db.list('Clientes').filter(function (r) { return celular(r.celular) === cel; })[0];
        if (!c) {
          var nombre = String(p.nombre || '').trim();
          if (nombre.length < 2) fail('Escribe tu nombre para registrarte');
          c = db.insert('Clientes', { id_cliente: uid('C'), nombre: nombre, celular: cel, email: String(p.email || ''),
            fecha_registro: ahora().fecha, origen: 'app', puntos_saldo: 0 });
        }
        return { session: nuevaSesion({ rol: 'cliente', id: c.id_cliente }), cliente: copia(c) };
      },
      loginEquipo: function (p) {
        var cel = celular(p.celular), pin = String(p.pin || '');
        var u = equipo().filter(function (r) { return celular(r.celular) === cel && cel; })[0];
        if (!u) fail('Celular o clave incorrectos');
        if (!u.clave_hash) {
          if (u.rol !== 'admin') fail('El administrador todavía no te ha asignado una clave');
          if (!/^\d{4,8}$/.test(pin)) fail('Primer ingreso: crea una clave de 4 a 8 números');
          db.update('Equipo', u._row, { clave_hash: hashPin(cel, pin) });
        } else if (u.clave_hash !== hashPin(cel, pin)) fail('Celular o clave incorrectos');
        return { session: nuevaSesion({ rol: u.rol, id: u.id }), usuario: { id: u.id, nombre: u.nombre, rol: u.rol, id_sede: u.id_sede, atiende: atiende(u) } };
      }
    };

    // ----- cliente -----
    var cliente = {
      misDatos: function (p, s) {
        var c = db.list('Clientes').filter(function (r) { return r.id_cliente === s.id; })[0];
        if (!c) fail('Cliente no encontrado');
        var n = nombres();
        var citas = db.list('Citas').filter(function (x) { return x.id_cliente === s.id; }).sort(ordenCitas).map(function (x) { return enriquecer(x, n); });
        var ventas = db.list('Ventas').filter(function (x) { return x.id_cliente === s.id; }).map(copia);
        var puntos = db.list('Puntos').filter(function (x) { return x.id_cliente === s.id; }).map(copia);
        return { cliente: copia(c), citas: citas, ventas: ventas, puntos: puntos,
          saldo: puntos.reduce(function (t, x) { return t + num(x.puntos); }, 0), hoy: ahora().fecha };
      },
      reservar: function (p, s) {
        return env.lock(function () {
          var sv = servicio(p.id_servicio), b = barbero(p.id_barbero);
          if (!si(b.agenda_activa)) fail('Este barbero no tiene la agenda activa');
          var ofrece = serviciosDe(b);
          if (ofrece.length && ofrece.indexOf(sv.id_servicio) < 0) fail('Este barbero no realiza ese servicio');
          var sedes = sedesDe(b);
          if (sedes.length && sedes.indexOf(p.id_sede) < 0) fail('Este barbero no atiende en esa sede');
          if (!db.list('Sedes').some(function (x) { return x.id_sede === p.id_sede && si(x.activa); })) fail('Sede no disponible');
          var libres = horasLibres(b.id, p.fecha, sv.duracion_min).slots;
          if (libres.indexOf(p.hora_inicio) < 0) fail('Ese horario ya no está disponible. Elige otro.');
          var dur = num(sv.duracion_min) || PASO_MIN;
          var cita = db.insert('Citas', { id_cita: uid('CT'), fecha: p.fecha, hora_inicio: p.hora_inicio,
            hora_fin: aHora(aMin(p.hora_inicio) + dur), id_cliente: s.id, id_barbero: b.id, id_sede: p.id_sede,
            id_servicio: sv.id_servicio, valor: num(sv.precio), comision: '', origen: p.origen || 'app',
            estado: 'confirmada', creado_en: ahora().stamp, notas: String(p.notas || '').slice(0, 200) });
          return enriquecer(cita, nombres());
        });
      },
      cancelarCita: function (p, s) {
        var c = db.list('Citas').filter(function (x) { return x.id_cita === p.id && x.id_cliente === s.id; })[0];
        if (!c) fail('Cita no encontrada');
        if (ACTIVAS.indexOf(c.estado) < 0) fail('Esta cita ya no se puede cancelar');
        db.update('Citas', c._row, { estado: 'cancelada' });
        return { id: c.id_cita, estado: 'cancelada' };
      },
      comprar: function (p, s) {
        var prods = porId(db.list('Productos'), 'id_producto'), total = 0, detalle = [];
        if (!p.items || !p.items.length) fail('El carrito está vacío');
        p.items.forEach(function (it) {
          var pr = prods[it.id_producto], cant = Math.floor(num(it.cantidad));
          if (!pr || !si(pr.activo)) fail('Un producto ya no está disponible');
          if (cant < 1 || cant > 20) fail('Cantidad no válida');
          total += num(pr.precio) * cant;
          detalle.push(pr.nombre + ' x' + cant);
        });
        if (['recoger_sede', 'domicilio'].indexOf(p.entrega) < 0) fail('Elige cómo recibes el pedido');
        if (p.entrega === 'domicilio' && String(p.direccion || '').trim().length < 5) fail('Escribe la dirección de entrega');
        var v = db.insert('Ventas', { id_venta: uid('V'), fecha: ahora().fecha, id_cliente: s.id, id_sede: p.id_sede || '',
          items: detalle.join('; ') + (p.entrega === 'domicilio' ? ' | Dirección: ' + String(p.direccion).slice(0, 120) : ''),
          total: total, metodo_pago: p.metodo_pago || 'efectivo', entrega: p.entrega, estado: 'pendiente', creado_en: ahora().stamp });
        return copia(v);
      }
    };

    // ----- barbero (y admin actuando sobre un barbero) -----
    function idBarbero(p, s) {
      if (s.rol === 'barbero') return s.id;                       // el barbero solo puede ver lo suyo
      if (s.rol === 'admin') return barbero(p.id_barbero || s.id).id; // el admin ve a cualquiera, o su propia agenda
      fail('Indica el barbero');
    }
    /**
     * Lo que ve el barbero de cada cita: servicio y su comisión, nunca el valor que paga el cliente.
     * El administrador ve además el valor.
     */
    function paraEquipo(c, pct, conValor) {
      var o = c;
      var activa = ACTIVAS.indexOf(c.estado) >= 0;
      o.comision_estimada = activa ? Math.round(num(c.valor) * pct / 100) : '';
      if (!activa && c.estado !== 'completada') o.comision = '';
      if (!conValor) delete o.valor;
      return o;
    }
    var barberoAcc = {
      miAgenda: function (p, s) {
        var id = idBarbero(p, s), b = barbero(id), fecha = esFecha(p.fecha) ? p.fecha : ahora().fecha, n = nombres();
        var pct = num(b.comision_pct), conValor = s.rol === 'admin';
        var citas = db.list('Citas').filter(function (c) { return c.id_barbero === id && c.fecha === fecha && c.estado !== 'cancelada'; })
          .sort(ordenCitas).map(function (c) { var o = enriquecer(c, n); o.cliente_celular = (n.cl[c.id_cliente] || {}).celular || ''; return paraEquipo(o, pct, conValor); });
        return { barbero: copia(b), fecha: fecha, citas: citas, hoy: ahora().fecha, conValor: conValor };
      },
      marcarCita: function (p, s) {
        var id = idBarbero(p, s);
        var c = db.list('Citas').filter(function (x) { return x.id_cita === p.id && x.id_barbero === id; })[0];
        if (!c) fail('Cita no encontrada');
        if (['completada', 'no_asistio'].indexOf(p.estado) < 0) fail('Estado no válido');
        if (ACTIVAS.indexOf(c.estado) < 0) fail('Esta cita ya fue marcada como ' + c.estado.replace('_', ' '));
        var cambios = { estado: p.estado };
        if (p.estado === 'completada') {
          var pct = num(barbero(id).comision_pct);
          cambios.comision = Math.round(num(c.valor) * pct / 100);
        }
        db.update('Citas', c._row, cambios);
        var pts = p.estado === 'completada' ? sumarPuntos(c.id_cliente, 'cita', c.id_cita, c.valor) : 0;
        return { id: c.id_cita, estado: p.estado, comision: cambios.comision || 0, puntos: pts };
      },
      setAgenda: function (p, s) {
        var b = barbero(idBarbero(p, s));
        db.update('Equipo', b._row, { agenda_activa: !!p.activa });
        return { id: b.id, agenda_activa: !!p.activa };
      },
      misHorarios: function (p, s) {
        var id = idBarbero(p, s), filas = db.list('Horarios').filter(function (h) { return h.id_barbero === id; });
        var orden = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        var hoy = ahora().fecha;
        return {
          dias: orden.map(function (d) {
            var f = filas.filter(function (h) { return h.dia === d; })[0] || { dia: d, activo: false };
            return { dia: d, activo: si(f.activo), hora_inicio: f.hora_inicio || '', hora_fin: f.hora_fin || '',
              descanso_inicio: f.descanso_inicio || '', descanso_fin: f.descanso_fin || '' };
          }),
          bloqueos: db.list('Bloqueos').filter(function (b) { return b.id_barbero === id && b.fecha >= hoy; }).map(copia)
        };
      },
      guardarHorario: function (p, s) {
        var id = idBarbero(p, s), filas = db.list('Horarios').filter(function (h) { return h.id_barbero === id; });
        (p.dias || []).forEach(function (d) {
          if (DIAS.indexOf(d.dia) < 0) fail('Día no válido');
          var activo = !!d.activo;
          if (activo) {
            if (!esHora(d.hora_inicio) || !esHora(d.hora_fin) || aMin(d.hora_fin) <= aMin(d.hora_inicio)) fail('Revisa las horas del ' + d.dia);
            if ((d.descanso_inicio || d.descanso_fin) && (!esHora(d.descanso_inicio) || !esHora(d.descanso_fin) ||
              aMin(d.descanso_fin) <= aMin(d.descanso_inicio))) fail('Revisa el descanso del ' + d.dia);
          }
          var fila = { activo: activo, hora_inicio: d.hora_inicio || '', hora_fin: d.hora_fin || '',
            descanso_inicio: d.descanso_inicio || '', descanso_fin: d.descanso_fin || '' };
          var ex = filas.filter(function (h) { return h.dia === d.dia; })[0];
          if (ex) db.update('Horarios', ex._row, fila);
          else { fila.id_barbero = id; fila.dia = d.dia; db.insert('Horarios', fila); }
        });
        return barberoAcc.misHorarios(p, s);
      },
      bloquear: function (p, s) {
        var id = idBarbero(p, s);
        if (!esFecha(p.fecha) || p.fecha < ahora().fecha) fail('Elige una fecha de hoy en adelante');
        if (!esHora(p.hora_inicio) || !esHora(p.hora_fin) || aMin(p.hora_fin) <= aMin(p.hora_inicio)) fail('Revisa las horas del bloqueo');
        return copia(db.insert('Bloqueos', { id_bloqueo: uid('BL'), id_barbero: id, fecha: p.fecha, hora_inicio: p.hora_inicio,
          hora_fin: p.hora_fin, motivo: String(p.motivo || '').slice(0, 120) }));
      },
      miControl: function (p, s) {
        var id = idBarbero(p, s), r = rango(p), n = nombres(), b = barbero(id);
        var pct = num(b.comision_pct), conValor = s.rol === 'admin';
        var citas = db.list('Citas').filter(function (c) { return c.id_barbero === id && enRango(r, c); })
          .sort(ordenCitas).map(function (c) { return paraEquipo(enriquecer(c, n), pct, conValor); });
        var servicios = db.list('Servicios').map(function (x) { var o = copia(x); if (!conValor) delete o.precio; return o; });
        return { desde: r.desde, hasta: r.hasta, citas: citas, servicios: servicios, hoy: ahora().fecha, conValor: conValor };
      }
    };

    // ----- solo administrador -----
    function guardar(tabla, col, prefijo, datos, campos, validar) {
      var filas = db.list(tabla), row = {};
      campos.forEach(function (c) { if (datos[c] !== undefined) row[c] = datos[c]; });
      if (validar) validar(row, filas);
      var ex = datos[col] ? filas.filter(function (r) { return r[col] === datos[col]; })[0] : null;
      if (ex) { db.update(tabla, ex._row, row); for (var k in row) ex[k] = row[k]; return copia(ex); }
      row[col] = secuencial(prefijo, filas, col);
      return copia(db.insert(tabla, row));
    }
    var admin = {
      adminData: function (p) {
        var r = rango(p), n = nombres();
        return {
          desde: r.desde, hasta: r.hasta,
          citas: db.list('Citas').filter(function (c) { return enRango(r, c); }).sort(ordenCitas).map(function (c) { return enriquecer(c, n); }),
          ventas: db.list('Ventas').filter(function (v) { return enRango(r, v); }).map(function (v) {
            var o = copia(v); o.cliente_nombre = (n.cl[v.id_cliente] || {}).nombre || v.id_cliente; return o;
          }),
          equipo: equipo().map(function (u) { var o = copia(u); o.tiene_clave = !!u.clave_hash; o.agenda_activa = si(u.agenda_activa); o.atiende = atiende(u); return o; }),
          sedes: db.list('Sedes').map(copia), servicios: db.list('Servicios').map(copia),
          productos: db.list('Productos').map(copia), totalClientes: db.list('Clientes').length
        };
      },
      guardarBarbero: function (p) {
        var d = p.row || {};
        var res = guardar('Equipo', 'id', 'B', d, ['nombre', 'celular', 'id_sede', 'comision_pct', 'especialidades', 'servicios', 'foto_url', 'agenda_activa'],
          function (row, filas) {
            if (row.nombre !== undefined && String(row.nombre).trim().length < 2) fail('Escribe el nombre del barbero');
            if (row.celular !== undefined) {
              row.celular = celular(row.celular);
              if (row.celular.length < 10) fail('Celular no válido');
              if (filas.some(function (r) { return celular(r.celular) === row.celular && r.id !== d.id; })) fail('Ese celular ya está registrado');
            }
            if (row.comision_pct !== undefined) { var c = num(row.comision_pct); if (c < 0 || c > 100) fail('La comisión va de 0 a 100'); row.comision_pct = c; }
            if (row.agenda_activa !== undefined) row.agenda_activa = !!row.agenda_activa;
            if (!d.id) { row.rol = 'barbero'; row.fecha_registro = ahora().fecha; if (row.agenda_activa === undefined) row.agenda_activa = true; }
          });
        if (p.pin) {
          if (!/^\d{4,8}$/.test(String(p.pin))) fail('La clave debe tener de 4 a 8 números');
          var u = equipo().filter(function (r) { return r.id === res.id; })[0];
          db.update('Equipo', u._row, { clave_hash: hashPin(u.celular, p.pin) });
        }
        var u2 = equipo().filter(function (r) { return r.id === res.id; })[0];
        if (atiende(u2) && !db.list('Horarios').some(function (h) { return h.id_barbero === res.id; })) {
          ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].forEach(function (dia) {
            db.insert('Horarios', { id_barbero: res.id, dia: dia, activo: dia !== 'domingo', hora_inicio: '', hora_fin: '', descanso_inicio: '', descanso_fin: '' });
          });
        }
        res.atiende = atiende(u2);
        return res;
      },
      guardarServicio: function (p) {
        return guardar('Servicios', 'id_servicio', 'SV', p.row || {}, ['nombre', 'descripcion', 'precio', 'duracion_min', 'activo', 'orden'], function (row) {
          if (row.nombre !== undefined && String(row.nombre).trim().length < 2) fail('Escribe el nombre del servicio');
          if (row.precio !== undefined) { row.precio = num(row.precio); if (row.precio < 0) fail('Precio no válido'); }
          if (row.duracion_min !== undefined) { row.duracion_min = num(row.duracion_min); if (row.duracion_min < 5 || row.duracion_min > 480) fail('Duración entre 5 y 480 minutos'); }
          if (row.activo !== undefined) row.activo = !!row.activo;
        });
      },
      guardarSede: function (p) {
        return guardar('Sedes', 'id_sede', 'S', p.row || {}, ['nombre', 'direccion', 'ciudad', 'telefono', 'horario_apertura', 'horario_cierre', 'activa'], function (row) {
          if (row.nombre !== undefined && String(row.nombre).trim().length < 2) fail('Escribe el nombre de la sede');
          if (row.activa !== undefined) row.activa = !!row.activa;
        });
      },
      guardarProducto: function (p) {
        return guardar('Productos', 'id_producto', 'P', p.row || {}, ['nombre', 'categoria', 'precio', 'sku', 'imagen_url', 'activo'], function (row) {
          if (row.nombre !== undefined && String(row.nombre).trim().length < 2) fail('Escribe el nombre del producto');
          if (row.precio !== undefined) { row.precio = num(row.precio); if (row.precio < 0) fail('Precio no válido'); }
          if (row.activo !== undefined) row.activo = !!row.activo;
        });
      },
      marcarVenta: function (p) {
        var v = db.list('Ventas').filter(function (x) { return x.id_venta === p.id; })[0];
        if (!v) fail('Pedido no encontrado');
        if (['pendiente', 'pagada', 'entregada', 'cancelada'].indexOf(p.estado) < 0) fail('Estado no válido');
        var yaPago = v.estado === 'pagada' || v.estado === 'entregada';
        db.update('Ventas', v._row, { estado: p.estado });
        var pts = 0;
        if (!yaPago && (p.estado === 'pagada' || p.estado === 'entregada')) pts = sumarPuntos(v.id_cliente, 'compra', v.id_venta, v.total);
        return { id: v.id_venta, estado: p.estado, puntos: pts };
      }
    };

    function handle(p) {
      p = p || {};
      if (!env.token || p.token !== env.token) fail('No autorizado');
      var a = p.action;
      if (publicas[a]) return publicas[a](p);
      var s = p.session ? env.sessions.get(p.session) : null;
      if (!s) fail('Tu sesión terminó. Ingresa de nuevo.');
      if (cliente[a]) { if (s.rol !== 'cliente') fail('Acción solo para clientes'); return cliente[a](p, s); }
      if (barberoAcc[a]) { if (s.rol !== 'barbero' && s.rol !== 'admin') fail('Acción solo para el equipo'); return barberoAcc[a](p, s); }
      if (admin[a]) { if (s.rol !== 'admin') fail('Acción solo para el administrador'); return admin[a](p, s); }
      fail('Acción no válida');
    }
    return { handle: handle };
  }

  return {
    createServer: createServer, resumen: resumen, slotsLibres: slotsLibres, sha256: sha256, hashPin: hashPin,
    celular: celular, aMin: aMin, aHora: aHora, cruza: cruza, diaDe: diaDe, sumarDias: sumarDias, num: num, si: si,
    DIAS: DIAS, PUNTOS_POR_MIL: PUNTOS_POR_MIL
  };
})();

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
