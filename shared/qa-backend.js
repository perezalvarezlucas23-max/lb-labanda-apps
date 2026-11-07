/*
 * Ambiente QA: base de datos de prueba en memoria / localStorage con las mismas tablas y columnas
 * que la hoja "LB La Banda – Base de datos". Los datos son ficticios y solo existen en este navegador.
 */
var LBQA = (function () {
  'use strict';
  var L = (typeof LB !== 'undefined') ? LB : require('./logic.js');

  var COLUMNAS = {
    Sedes: ['id_sede', 'nombre', 'direccion', 'ciudad', 'telefono', 'horario_apertura', 'horario_cierre', 'activa'],
    Equipo: ['id', 'nombre', 'celular', 'rol', 'id_sede', 'comision_pct', 'especialidades', 'servicios', 'foto_url', 'agenda_activa', 'clave_hash', 'fecha_registro'],
    Servicios: ['id_servicio', 'nombre', 'descripcion', 'precio', 'duracion_min', 'activo', 'orden'],
    Horarios: ['id_barbero', 'dia', 'activo', 'hora_inicio', 'hora_fin', 'descanso_inicio', 'descanso_fin'],
    Bloqueos: ['id_bloqueo', 'id_barbero', 'fecha', 'hora_inicio', 'hora_fin', 'motivo'],
    Clientes: ['id_cliente', 'nombre', 'celular', 'email', 'fecha_registro', 'origen', 'puntos_saldo'],
    Citas: ['id_cita', 'fecha', 'hora_inicio', 'hora_fin', 'id_cliente', 'id_barbero', 'id_sede', 'id_servicio', 'valor', 'comision', 'origen', 'estado', 'creado_en', 'notas'],
    Productos: ['id_producto', 'nombre', 'categoria', 'precio', 'sku', 'imagen_url', 'activo'],
    Inventario: ['id_producto', 'id_sede', 'stock'],
    Ventas: ['id_venta', 'fecha', 'id_cliente', 'id_sede', 'items', 'total', 'metodo_pago', 'entrega', 'estado', 'creado_en'],
    Puntos: ['id_mov', 'fecha', 'id_cliente', 'tipo', 'referencia', 'puntos']
  };

  /** Usuarios de prueba (solo QA). */
  var CREDENCIALES = [
    { rol: 'Administrador', nombre: 'Admin QA', celular: '3000000000', pin: '0000' },
    { rol: 'Barbero', nombre: 'Barbero QA 1', celular: '3000000001', pin: '1111' },
    { rol: 'Barbero', nombre: 'Barbero QA 2', celular: '3000000002', pin: '2222' },
    { rol: 'Barbero', nombre: 'Barbero QA 3', celular: '3000000003', pin: '3333' },
    { rol: 'Barbero (agenda pausada)', nombre: 'Barbero QA 4', celular: '3000000004', pin: '4444' },
    { rol: 'Cliente', nombre: 'Cliente QA', celular: '3100000001', pin: '(sin clave)' }
  ];

  function semilla(hoy) {
    var t = {};
    Object.keys(COLUMNAS).forEach(function (k) { t[k] = []; });
    t.Sedes = [
      { id_sede: 'S1', nombre: 'Sede QA Centro', direccion: 'Dirección de prueba 1', ciudad: 'Medellín', telefono: '', horario_apertura: '09:00', horario_cierre: '20:00', activa: true },
      { id_sede: 'S2', nombre: 'Sede QA Norte', direccion: 'Dirección de prueba 2', ciudad: 'Medellín', telefono: '', horario_apertura: '09:00', horario_cierre: '20:00', activa: true }
    ];
    var esp = ['Fade y degradados', 'Barba y perfilado', 'Diseños y líneas', 'Cortes clásicos'];
    CREDENCIALES.forEach(function (c, i) {
      if (c.rol === 'Cliente') return;
      var admin = i === 0;
      t.Equipo.push({ id: admin ? 'ADM1' : 'B' + i, nombre: c.nombre, celular: c.celular, rol: admin ? 'admin' : 'barbero',
        id_sede: admin ? '' : (i <= 2 ? 'S1' : 'S2'), comision_pct: admin ? '' : 40, especialidades: admin ? '' : esp[i - 1],
        servicios: admin ? '' : 'SV1,SV2,SV3,SV4', foto_url: '', agenda_activa: !admin && i !== 4,
        clave_hash: L.hashPin(c.celular, c.pin), fecha_registro: hoy });
    });
    t.Servicios = [
      { id_servicio: 'SV1', nombre: 'Corte', descripcion: '', precio: 25000, duracion_min: 30, activo: true, orden: 1 },
      { id_servicio: 'SV2', nombre: 'Barba', descripcion: '', precio: 15000, duracion_min: 30, activo: true, orden: 2 },
      { id_servicio: 'SV3', nombre: 'Corte + Barba', descripcion: 'Combo', precio: 35000, duracion_min: 60, activo: true, orden: 3 },
      { id_servicio: 'SV4', nombre: 'Corte Premium', descripcion: 'Servicio premium', precio: 50000, duracion_min: 60, activo: true, orden: 4 }
    ];
    ['B1', 'B2', 'B3', 'B4'].forEach(function (b) {
      ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].forEach(function (d) {
        t.Horarios.push({ id_barbero: b, dia: d, activo: d !== 'domingo', hora_inicio: '09:00', hora_fin: '19:00', descanso_inicio: '13:00', descanso_fin: '14:00' });
      });
    });
    t.Clientes = [
      { id_cliente: 'C0001', nombre: 'Cliente QA', celular: '3100000001', email: '', fecha_registro: hoy, origen: 'app', puntos_saldo: 0 },
      { id_cliente: 'C0002', nombre: 'Cliente QA 2', celular: '3100000002', email: '', fecha_registro: hoy, origen: 'whatsapp', puntos_saldo: 0 }
    ];
    t.Productos = [
      { id_producto: 'P1', nombre: 'Camiseta La Banda', categoria: 'ropa', precio: 60000, sku: 'QA-CAM', imagen_url: '', activo: true },
      { id_producto: 'P2', nombre: 'Gorra LB', categoria: 'accesorios', precio: 45000, sku: 'QA-GOR', imagen_url: '', activo: true },
      { id_producto: 'P3', nombre: 'Aceite para barba', categoria: 'grooming', precio: 30000, sku: 'QA-ACE', imagen_url: '', activo: true },
      { id_producto: 'P4', nombre: 'Cera de peinado', categoria: 'grooming', precio: 28000, sku: 'QA-CER', imagen_url: '', activo: true }
    ];
    // historial de prueba: últimos 10 días, para que los tableros tengan datos
    var n = 0;
    for (var d = 10; d >= 1; d--) {
      var f = L.sumarDias(hoy, -d);
      if (L.diaDe(f) === 'domingo') continue;
      [['B1', 'S1', 'SV4', '10:00'], ['B2', 'S1', 'SV1', '11:00'], ['B3', 'S2', 'SV3', '15:00'], ['B1', 'S1', 'SV2', '16:00']].forEach(function (x, j) {
        var sv = t.Servicios.filter(function (s) { return s.id_servicio === x[2]; })[0];
        var est = (d + j) % 7 === 0 ? 'no_asistio' : ((d + j) % 9 === 0 ? 'cancelada' : 'completada');
        n++;
        t.Citas.push({ id_cita: 'CTQA' + ('000' + n).slice(-4), fecha: f, hora_inicio: x[3], hora_fin: L.aHora(L.aMin(x[3]) + sv.duracion_min),
          id_cliente: j % 2 ? 'C0002' : 'C0001', id_barbero: x[0], id_sede: x[1], id_servicio: x[2], valor: sv.precio,
          comision: est === 'completada' ? Math.round(sv.precio * 0.4) : '', origen: ['app', 'whatsapp', 'presencial', 'app'][j],
          estado: est, creado_en: f + ' 08:00', notas: '' });
      });
    }
    // citas de hoy para probar la agenda del barbero
    [['B1', 'S1', 'SV1', '17:00', 'C0002'], ['B1', 'S1', 'SV4', '18:00', 'C0001'], ['B2', 'S1', 'SV3', '17:30', 'C0002']].forEach(function (x, j) {
      var sv = t.Servicios.filter(function (s) { return s.id_servicio === x[2]; })[0];
      t.Citas.push({ id_cita: 'CTQAH' + j, fecha: hoy, hora_inicio: x[3], hora_fin: L.aHora(L.aMin(x[3]) + sv.duracion_min),
        id_cliente: x[4], id_barbero: x[0], id_sede: x[1], id_servicio: x[2], valor: sv.precio, comision: '', origen: 'app',
        estado: 'confirmada', creado_en: hoy + ' 08:00', notas: '' });
    });
    t.Ventas.push({ id_venta: 'VQA0001', fecha: L.sumarDias(hoy, -2), id_cliente: 'C0001', id_sede: 'S1', items: 'Gorra LB x1', total: 45000,
      metodo_pago: 'nequi', entrega: 'recoger_sede', estado: 'pagada', creado_en: '' });
    return t;
  }

  /** db con la misma interfaz que la hoja: list / insert / update. `persist` guarda en cada cambio. */
  function createDb(tablas, persist) {
    function tabla(n) { if (!tablas[n]) tablas[n] = []; return tablas[n]; }
    return {
      list: function (n) {
        return tabla(n).map(function (r, i) { var o = { _row: i + 2 }; for (var k in r) o[k] = r[k]; return o; });
      },
      insert: function (n, row) {
        var cols = COLUMNAS[n], o = {};
        cols.forEach(function (c) { o[c] = row[c] === undefined ? '' : row[c]; });
        tabla(n).push(o);
        if (persist) persist(tablas);
        var r = { _row: tabla(n).length + 1 }; for (var k in o) r[k] = o[k]; return r;
      },
      update: function (n, rowIdx, cambios) {
        var r = tabla(n)[rowIdx - 2];
        if (!r) throw new Error('Fila no encontrada');
        for (var k in cambios) if (COLUMNAS[n].indexOf(k) > 0) r[k] = cambios[k];
        if (persist) persist(tablas);
      }
    };
  }

  function horaColombia(fecha) {
    var d = fecha || new Date();
    var bog = new Date(d.getTime() - 5 * 3600 * 1000); // Colombia: UTC-5 todo el año
    var iso = bog.toISOString();
    return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16), stamp: iso.slice(0, 10) + ' ' + iso.slice(11, 16) };
  }

  function memorySessions() {
    var m = {};
    return { get: function (k) { return m[k] || null; }, put: function (k, v) { m[k] = v; } };
  }

  return { COLUMNAS: COLUMNAS, CREDENCIALES: CREDENCIALES, semilla: semilla, createDb: createDb, horaColombia: horaColombia, memorySessions: memorySessions };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LBQA;
