// Prueba de punta a punta en navegador (ambiente QA). Requiere Playwright: npm i -D playwright && npx playwright install chromium
// Ejecutar: node --test tests/e2e.test.js   (las capturas quedan en tests/capturas/)
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(__dirname, 'capturas');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let server, base, browser;

test.before(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  server = http.createServer((req, res) => {
    let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (f.endsWith('/')) f += 'index.html';
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  }).listen(0);
  base = 'http://localhost:' + server.address().port;
  browser = await chromium.launch();
});
test.after(async () => { await browser.close(); server.close(); });

async function nuevaPagina(ctx, ancho = 390, alto = 844) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: ancho, height: alto });
  p.errores = [];
  p.on('pageerror', (e) => p.errores.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  return p;
}
const foto = (p, n) => p.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: true });

test('cliente reserva → barbero atiende → admin ve el resultado y cambia un precio', async () => {
  const ctx = await browser.newContext();          // mismo dispositivo: QA comparte los datos entre las dos apps
  const c = await nuevaPagina(ctx);
  await c.goto(base + '/cliente/?env=qa');
  await c.evaluate(() => { localStorage.clear(); });
  await c.reload();

  // registro de cliente nuevo
  await c.fill('#celular', '3205551234');
  await c.click('button[type=submit]');
  await c.getByText('Escribe tu nombre para registrarte').waitFor();
  await c.fill('#nombre', 'Tester QA');
  await c.click('button[type=submit]');
  await c.getByText('Hola,').waitFor();
  await foto(c, '01-cliente-inicio');

  // reserva: sede → servicio → barbero → horario → confirmar
  await c.click('text=Reservar ahora');
  await c.click('text=Sede QA Centro');
  await c.click('text=Corte Premium');
  await c.click('a[href="#/barbero/B2"]');
  await c.getByText('Próximos espacios libres').waitFor();
  await c.click('text=Reservar con Barbero QA 2');
  await c.waitForSelector('.slot');
  await c.click('.day >> nth=2');                  // pasado mañana, para no depender de la hora actual
  await c.waitForSelector('.slot');
  const hora = await c.locator('.slot').first().innerText();
  await c.locator('.slot').first().click();
  await foto(c, '02-cliente-horario');
  await c.click('text=Continuar');
  await c.getByText('Confirma tu cita').waitFor();
  await c.click('text=Confirmar reserva');
  await c.getByText('Te esperamos').waitFor();
  await foto(c, '03-cliente-confirmada');

  // la misma hora ya no se ofrece a nadie
  await c.goto(base + '/cliente/#/reservar/sede');
  await c.click('text=Sede QA Centro');
  await c.click('text=Corte Premium');
  await c.click('a[href="#/barbero/B2"]');
  await c.click('text=Reservar con Barbero QA 2');
  await c.waitForSelector('.slot');
  await c.click('.day >> nth=2');
  await c.waitForSelector('.slot');
  const horas = await c.locator('.slot').allInnerTexts();
  assert.ok(!horas.includes(hora), 'la hora reservada desaparece de la agenda');

  // tienda
  await c.goto(base + '/cliente/#/tienda');
  await c.click('[aria-label="Agregar Gorra LB al carrito"]');
  await c.click('[aria-label="Ver carrito"]');
  await c.click('text=Hacer pedido');
  await c.getByText('Pedido recibido').waitFor();
  await c.getByText('Próximas citas').waitFor();
  await c.keyboard.press('Escape');
  assert.strictEqual(await c.locator('.sheet-bg').count(), 0, 'la ventana se cierra con Escape');
  await foto(c, '04-cliente-perfil');

  // barbero 2 entra, ve la cita y la marca atendida
  const b = await nuevaPagina(ctx);
  await b.goto(base + '/equipo/');
  await b.fill('#cel', '3000000002');
  await b.fill('#pin', '0000');
  await b.click('button[type=submit]');
  await b.getByText('Celular o clave incorrectos').waitFor();
  await b.fill('#pin', '2222');
  await b.click('button[type=submit]');
  await b.getByText('Agenda activa').first().waitFor();
  await b.click('[aria-label="Día siguiente"]');
  await b.click('[aria-label="Día siguiente"]');
  await b.getByText('Tester QA').waitFor();
  assert.strictEqual(await b.getByText(/Valor \$/).count(), 0, 'el barbero no ve el valor que paga el cliente');
  await b.getByText(/Comisión estimada/).first().waitFor();
  await foto(b, '05-barbero-agenda');
  await b.click('text=Marcar atendida');
  await b.getByText('Atendida', { exact: true }).first().waitFor();
  // pausa su agenda: el cliente ya no lo ve disponible
  await b.click('[aria-label="Activar o pausar la agenda"]');
  await b.getByText('Agenda pausada').first().waitFor();
  await b.click('role=tab[name="Historial"]');
  await b.getByText('Comisión ganada').first().waitFor();
  await foto(b, '05b-barbero-historial');
  await b.click('role=tab[name="Próximas"]');
  await b.getByText('Citas próximas').waitFor();
  assert.strictEqual(await b.getByText('Tester QA').count(), 0, 'la cita ya atendida no figura como próxima');
  await b.click('role=tab[name="Hoy"]');
  await b.goto(base + '/equipo/#/control');
  await b.locator('h1', { hasText: 'Mi control' }).waitFor();
  await foto(b, '06-barbero-control');

  // admin (panel web en computador)
  const a = await nuevaPagina(ctx, 1366, 900);
  await a.goto(base + '/equipo/');
  await a.evaluate(() => { Object.keys(localStorage).filter((k) => k.startsWith('lb_eq_')).forEach((k) => localStorage.removeItem(k)); });
  await a.reload();
  await a.fill('#cel', '3000000000');
  await a.fill('#pin', '0000');
  await a.click('button[type=submit]');
  await a.getByText('Control general').waitFor();
  await a.click('text=Rango de fechas');
  await a.waitForSelector('input[type=date]');
  const fechas = a.locator('input[type=date]');
  // el rango arranca en el mes en curso; lo extiendo hasta pasado mañana (día de la cita)
  const masDos = await a.evaluate(() => LB.sumarDias(LBQA.horaColombia().fecha, 2));
  await fechas.nth(1).fill(masDos);
  await fechas.nth(1).dispatchEvent('change');
  await a.waitForFunction((f) => document.querySelectorAll('input[type=date]')[1] && document.querySelectorAll('input[type=date]')[1].value === f, masDos);
  await a.getByText('Tester QA').first().waitFor();
  await foto(a, '07-admin-panel-web');
  await a.selectOption('#fbarbero', 'B2');
  await a.getByText('Tester QA').first().waitFor();
  await a.click('button:has-text("Sede QA Norte")');
  assert.strictEqual(await a.getByText('Tester QA').count(), 0, 'el filtro por sede oculta citas de otra sede');

  await a.click('a[href="#/servicios"]');
  await a.locator('h1', { hasText: 'Servicios y precios' }).waitFor();
  const premium = a.locator('.card.hot');
  await premium.locator('[aria-label="Precio"]').fill('55000');
  await premium.locator('button:has-text("Guardar")').click();
  await a.getByText('Servicio guardado').waitFor();
  await a.click('a[href="#/barberos"]');
  await a.locator('h1', { hasText: 'Barberos' }).waitFor();
  await foto(a, '08-admin-barberos');

  // el cliente ve el nuevo precio y al barbero 2 como no disponible
  await c.bringToFront();
  await c.goto(base + '/cliente/#/reservar/sede');
  await c.click('text=Sede QA Centro');
  await c.getByText('Elige tu servicio').waitFor();
  await foto(c, '10-cliente-precio-nuevo');
  await c.getByText(/55\.000/).waitFor();
  await c.click('text=Corte Premium');
  const tarjetaB2 = c.locator('a[href="#/barbero/B2"]');
  assert.match(await tarjetaB2.innerText(), /Hoy no atiende/);

  // el administrador ve su propia agenda (también atiende) y el valor de los servicios
  await a.click('a[href="#/agendas"]');
  await a.getByText('Mi agenda').first().waitFor();
  await a.click('button.chip:has-text("Barbero QA 1")');
  await a.getByText(/Valor \$/).first().waitFor();
  await foto(a, '08b-admin-agendas');

  // admin móvil
  const am = await nuevaPagina(ctx);
  await am.goto(base + '/equipo/#/resumen');
  await am.getByText('Control general').waitFor();
  await foto(am, '09-admin-movil');

  for (const p of [c, b, a, am]) assert.deepStrictEqual(p.errores, [], 'sin errores de JavaScript');
});
