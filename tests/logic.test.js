// Pruebas de la lógica de negocio (QA). Ejecutar: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const LB = require('../shared/logic.js');
const QA = require('../shared/qa-backend.js');

const HOY = '2026-11-09'; // lunes
function montar(hora = '08:00', fecha = HOY) {
  const tablas = QA.semilla(fecha);
  const db = QA.createDb(tablas);
  const reloj = { fecha, hora };
  let k = 0;
  const server = LB.createServer(db, {
    token: 't', now: () => ({ fecha: reloj.fecha, hora: reloj.hora, stamp: reloj.fecha + ' ' + reloj.hora }),
    sessions: QA.memorySessions(), newKey: () => 'k' + (++k), lock: (fn) => fn()
  });
  const call = (action, p = {}) => server.handle(Object.assign({ token: 't', action }, p));
  return { tablas, db, call, reloj };
}
const loginCli = (c) => c.call('loginCliente', { celular: '3100000001' }).session;
const loginEq = (c, cel, pin) => c.call('loginEquipo', { celular: cel, pin }).session;

test('sha256 coincide con la implementación estándar', () => {
  for (const s of ['', 'abc', 'lb|3000000000|0000', 'x'.repeat(55), 'y'.repeat(56), 'ñandú 🚀'.repeat(20)]) {
    assert.strictEqual(LB.sha256(s), crypto.createHash('sha256').update(s, 'utf8').digest('hex'));
  }
});

test('sin token correcto no responde', () => {
  const c = montar();
  assert.throws(() => c.call('catalogo', { token: 'malo' }), /No autorizado/);
});

test('catálogo no expone claves y trae los 4 servicios con Corte Premium', () => {
  const c = montar();
  const cat = c.call('catalogo');
  assert.strictEqual(cat.servicios.length, 4);
  assert.ok(cat.servicios.some((s) => s.nombre === 'Corte Premium'));
  assert.strictEqual(cat.barberos.length, 5, '4 barberos + el administrador que también atiende');
  assert.ok(cat.barberos.every((b) => b.clave_hash === undefined && b.celular === undefined));
});

test('disponibilidad respeta turno, descanso, duración y citas existentes', () => {
  const c = montar();
  const r = c.call('disponibilidad', { id_barbero: 'B1', fecha: HOY, id_servicio: 'SV4' }); // 60 min
  assert.ok(r.activa);
  assert.ok(r.slots.includes('09:00'));
  assert.ok(!r.slots.includes('12:30'), '12:30-13:30 cruza el descanso');
  assert.ok(!r.slots.includes('13:00'));
  assert.ok(r.slots.includes('14:00'));
  assert.ok(!r.slots.includes('16:30'), 'cruza la cita de las 17:00');
  assert.ok(!r.slots.includes('18:30'), 'se pasa de las 19:00');
});

test('hoy no ofrece horas que ya pasaron; domingo sin turno', () => {
  const c = montar('15:10');
  const r = c.call('disponibilidad', { id_barbero: 'B2', fecha: HOY, id_servicio: 'SV1' });
  assert.ok(r.slots.every((h) => LB.aMin(h) > LB.aMin('15:10')));
  const dom = c.call('disponibilidad', { id_barbero: 'B2', fecha: '2026-11-15', id_servicio: 'SV1' });
  assert.deepStrictEqual(dom.slots, []);
});

test('barbero con agenda pausada no recibe reservas', () => {
  const c = montar();
  assert.deepStrictEqual(c.call('disponibilidad', { id_barbero: 'B4', fecha: HOY, id_servicio: 'SV1' }).slots, []);
  const s = loginCli(c);
  assert.throws(() => c.call('reservar', { session: s, id_barbero: 'B4', id_sede: 'S2', id_servicio: 'SV1', fecha: HOY, hora_inicio: '10:00' }), /agenda activa/);
});

test('reservar crea la cita con precio del servicio y evita doble reserva', () => {
  const c = montar();
  const s = loginCli(c);
  const cita = c.call('reservar', { session: s, id_barbero: 'B1', id_sede: 'S1', id_servicio: 'SV4', fecha: HOY, hora_inicio: '10:00' });
  assert.strictEqual(cita.valor, 50000);
  assert.strictEqual(cita.hora_fin, '11:00');
  assert.strictEqual(cita.estado, 'confirmada');
  assert.throws(() => c.call('reservar', { session: s, id_barbero: 'B1', id_sede: 'S1', id_servicio: 'SV1', fecha: HOY, hora_inicio: '10:30' }), /no está disponible/);
  assert.throws(() => c.call('reservar', { session: s, id_barbero: 'B1', id_sede: 'S2', id_servicio: 'SV1', fecha: HOY, hora_inicio: '15:00' }), /no atiende en esa sede/);
});

test('roles: cliente no ve datos de admin; barbero no ve los de otro', () => {
  const c = montar();
  const s = loginCli(c);
  assert.throws(() => c.call('adminData', { session: s }), /administrador/);
  const b1 = loginEq(c, '3000000001', '1111');
  assert.throws(() => c.call('adminData', { session: b1 }), /administrador/);
  const ag = c.call('miAgenda', { session: b1, id_barbero: 'B2' });
  assert.strictEqual(ag.barbero.id, 'B1', 'el barbero siempre ve solo su agenda');
  assert.throws(() => c.call('loginEquipo', { celular: '3000000001', pin: '9999' }), /incorrectos/);
});

test('marcar atendida calcula comisión y suma puntos una sola vez', () => {
  const c = montar();
  const b1 = loginEq(c, '3000000001', '1111');
  const r = c.call('marcarCita', { session: b1, id: 'CTQAH1', estado: 'completada' }); // Corte Premium 50.000
  assert.strictEqual(r.comision, 20000);
  assert.strictEqual(r.puntos, 50);
  assert.throws(() => c.call('marcarCita', { session: b1, id: 'CTQAH1', estado: 'completada' }), /ya fue marcada/);
  const datos = c.call('misDatos', { session: loginCli(c) });
  assert.strictEqual(datos.saldo, 50);
  assert.throws(() => c.call('marcarCita', { session: b1, id: 'CTQAH2', estado: 'completada' }), /no encontrada/, 'cita de otro barbero');
});

test('pausar agenda y horarios: validaciones', () => {
  const c = montar();
  const b2 = loginEq(c, '3000000002', '2222');
  c.call('setAgenda', { session: b2, activa: false });
  assert.strictEqual(c.call('catalogo').barberos.find((b) => b.id === 'B2').agenda_activa, false);
  assert.throws(() => c.call('guardarHorario', { session: b2, dias: [{ dia: 'lunes', activo: true, hora_inicio: '18:00', hora_fin: '09:00' }] }), /Revisa las horas/);
  const h = c.call('guardarHorario', { session: b2, dias: [{ dia: 'domingo', activo: true, hora_inicio: '10:00', hora_fin: '14:00' }] });
  assert.strictEqual(h.dias.find((d) => d.dia === 'domingo').activo, true);
  c.call('bloquear', { session: b2, fecha: HOY, hora_inicio: '09:00', hora_fin: '12:00', motivo: 'Permiso' });
  c.call('setAgenda', { session: b2, activa: true });
  const libres = c.call('disponibilidad', { id_barbero: 'B2', fecha: HOY, id_servicio: 'SV1' }).slots;
  assert.ok(!libres.includes('09:00') && !libres.includes('11:30') && libres.includes('12:00'));
});

test('admin: primer ingreso crea clave, registra barbero con PIN y edita precios', () => {
  const tablas = QA.semilla(HOY);
  tablas.Equipo[0].clave_hash = '';
  const db = QA.createDb(tablas); let k = 0;
  const server = LB.createServer(db, { token: 't', now: () => ({ fecha: HOY, hora: '08:00', stamp: HOY + ' 08:00' }), sessions: QA.memorySessions(), newKey: () => 'k' + (++k), lock: (f) => f() });
  const call = (action, p = {}) => server.handle(Object.assign({ token: 't', action }, p));
  assert.throws(() => call('loginEquipo', { celular: '3000000000', pin: '12' }), /4 a 8/);
  const adm = call('loginEquipo', { celular: '3000000000', pin: '5678' }).session;
  assert.throws(() => call('loginEquipo', { celular: '3000000000', pin: '0000' }), /incorrectos/);
  const nuevo = call('guardarBarbero', { session: adm, row: { nombre: 'Barbero Nuevo', celular: '3000000005', id_sede: 'S2', comision_pct: 35 }, pin: '5555' });
  assert.strictEqual(nuevo.id, 'B5');
  assert.throws(() => call('guardarBarbero', { session: adm, row: { nombre: 'Otro', celular: '3000000005' } }), /ya está registrado/);
  assert.ok(call('loginEquipo', { celular: '3000000005', pin: '5555' }).session);
  call('guardarServicio', { session: adm, row: { id_servicio: 'SV4', precio: 55000 } });
  assert.strictEqual(call('catalogo').servicios.find((s) => s.id_servicio === 'SV4').precio, 55000);
  assert.ok(db.list('Horarios').filter((h) => h.id_barbero === 'B5').length === 7);
});

test('compras: total calculado en el servidor y puntos al pagar', () => {
  const c = montar();
  const s = loginCli(c);
  const v = c.call('comprar', { session: s, id_sede: 'S1', entrega: 'recoger_sede', metodo_pago: 'nequi', items: [{ id_producto: 'P1', cantidad: 2 }, { id_producto: 'P3', cantidad: 1 }] });
  assert.strictEqual(v.total, 150000);
  assert.strictEqual(v.estado, 'pendiente');
  assert.throws(() => c.call('comprar', { session: s, entrega: 'domicilio', items: [{ id_producto: 'P1', cantidad: 1 }] }), /dirección/);
  const adm = loginEq(c, '3000000000', '0000');
  assert.strictEqual(c.call('marcarVenta', { session: adm, id: v.id_venta, estado: 'pagada' }).puntos, 150);
  assert.strictEqual(c.call('marcarVenta', { session: adm, id: v.id_venta, estado: 'entregada' }).puntos, 0);
});

test('resumen filtra por sede y barbero y cuadra totales', () => {
  const c = montar();
  const adm = loginEq(c, '3000000000', '0000');
  const d = c.call('adminData', { session: adm, desde: LB.sumarDias(HOY, -10), hasta: HOY });
  const todo = LB.resumen(d.citas, d.ventas, {});
  const s1 = LB.resumen(d.citas, d.ventas, { sede: 'S1' });
  const s2 = LB.resumen(d.citas, d.ventas, { sede: 'S2' });
  assert.strictEqual(s1.ingresosServicios + s2.ingresosServicios, todo.ingresosServicios);
  assert.strictEqual(s1.atendidos + s2.atendidos, todo.atendidos);
  const b1 = LB.resumen(d.citas, d.ventas, { barbero: 'B1' });
  assert.strictEqual(b1.atendidos, todo.porBarbero.B1.atendidos);
  const manual = d.citas.filter((x) => x.estado === 'completada').reduce((t, x) => t + x.valor, 0);
  assert.strictEqual(todo.ingresosServicios, manual);
  assert.strictEqual(todo.ventasTienda, 45000);
  assert.strictEqual(todo.utilidad, todo.ingresosTotales - todo.comisiones);
});

test('el barbero ve servicio y comisión, nunca el valor que paga el cliente', () => {
  const c = montar();
  const b1 = loginEq(c, '3000000001', '1111');
  const ag = c.call('miAgenda', { session: b1 });
  assert.ok(ag.citas.length > 0);
  for (const x of ag.citas) {
    assert.strictEqual(x.valor, undefined, 'sin valor del cliente');
    assert.ok(x.comision_estimada > 0, 've su comisión estimada');
  }
  const ctl = c.call('miControl', { session: b1, desde: LB.sumarDias(HOY, -10), hasta: LB.sumarDias(HOY, 30) });
  assert.ok(ctl.citas.every((x) => x.valor === undefined));
  assert.ok(ctl.servicios.every((s) => s.precio === undefined), 'tampoco ve la lista de precios por esta vía');
  assert.ok(ctl.citas.filter((x) => x.estado === 'completada').every((x) => x.comision > 0));
  assert.strictEqual(ctl.conValor, false);
  // el administrador sí ve el valor de la agenda de cualquier barbero
  const adm = loginEq(c, '3000000000', '0000');
  assert.ok(c.call('miAgenda', { session: adm, id_barbero: 'B1' }).citas.every((x) => x.valor > 0));
});

test('el administrador también atiende: tiene su agenda, los clientes lo pueden reservar', () => {
  const c = montar();
  const login = c.call('loginEquipo', { celular: '3000000000', pin: '0000' });
  assert.strictEqual(login.usuario.atiende, true);
  const adm = login.session;
  const s = loginCli(c);
  const cita = c.call('reservar', { session: s, id_barbero: 'ADM1', id_sede: 'S1', id_servicio: 'SV4', fecha: HOY, hora_inicio: '09:00' });
  assert.throws(() => c.call('reservar', { session: s, id_barbero: 'ADM1', id_sede: 'S1', id_servicio: 'SV2', fecha: HOY, hora_inicio: '11:00' }), /no realiza ese servicio/);
  const ag = c.call('miAgenda', { session: adm });               // sin id_barbero: su propia agenda
  assert.ok(ag.citas.some((x) => x.id_cita === cita.id_cita));
  const r = c.call('marcarCita', { session: adm, id: cita.id_cita, estado: 'completada' });
  assert.strictEqual(r.comision, 0, 'el dueño no lleva comisión');
  // deja de atender: desaparece del catálogo y conserva el control total
  c.call('guardarBarbero', { session: adm, row: { id: 'ADM1', servicios: '', agenda_activa: false } });
  assert.ok(!c.call('catalogo').barberos.some((b) => b.id === 'ADM1'));
  assert.ok(c.call('adminData', { session: adm }).citas.length > 0);
  assert.throws(() => c.call('miAgenda', { session: adm }), /Barbero no encontrado/);
});
