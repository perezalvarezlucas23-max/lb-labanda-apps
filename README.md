# LB La Banda – Apps

Dos apps instalables (PWA) para la barbería **LB La Banda**, con la información guardada en Google Sheets (sin costo al inicio).

| App | Para quién | Dirección (GitHub Pages) |
| --- | --- | --- |
| **La Banda** | Clientes: reservar, tienda, puntos | `https://<usuario>.github.io/lb-labanda-apps/cliente/` |
| **LB Equipo** | Barberos (solo sus servicios y comisión) y administrador (toda la operación; también puede atender). En computador es el **panel web** | `https://<usuario>.github.io/lb-labanda-apps/equipo/` |

## Ambientes

| Ambiente | Datos | Para qué |
| --- | --- | --- |
| **QA** (por defecto) | Ficticios, dentro de cada celular. No toca Google Sheets. | Probar diseño y flujos sin riesgo. Botón **Usuarios de prueba** en la franja amarilla. |
| **STAGING** | Hoja **LB La Banda – Base de datos STAGING** | Pruebas reales con el equipo antes de abrir a clientes. Ver [docs/STAGING.md](docs/STAGING.md). |
| **PROD** | Hoja **LB La Banda – Base de datos** | Operación real. |

El ambiente se define en `shared/config.js`. Un tester puede cambiarlo en su celular agregando `?env=qa` o `?env=staging` al enlace.

## Estructura

```
cliente/        App La Banda (clientes)
equipo/         App LB Equipo (barbero, administrador y panel web)
shared/         logic.js (reglas del negocio), api.js, ui.js, lb.css, config.js, qa-backend.js, logos
server/         gs-adapter.js (conexión con Google Sheets)
dist/lb-api.gs  Archivo único para pegar en Apps Script (se genera con npm run build)
tests/          Pruebas automáticas
docs/           Plan de pruebas QA y guía STAGING
```

Las reglas del negocio (disponibilidad, doble reserva, roles, comisiones, puntos, totales) están **una sola vez** en `shared/logic.js`. Ese mismo archivo corre en el navegador (QA), en las pruebas y dentro de Google Apps Script (STAGING/PROD), así QA prueba exactamente lo que irá a producción.

## Probar en el computador

```bash
npm install          # solo para las pruebas en navegador
npm run build        # genera dist/lb-api.gs
npm test             # pruebas de lógica + API simulada de Sheets + punta a punta en navegador
npx serve .          # o: python3 -m http.server   → abre http://localhost:3000/cliente/
```

## Publicar en GitHub Pages

1. En github.com crea un repositorio **público** llamado `lb-labanda-apps` (GitHub Pages gratis requiere repositorio público; el código no tiene claves).
2. Botón **Add file › Upload files**, arrastra **todo el contenido** de esta carpeta y confirma con **Commit changes**.
3. **Settings › Pages › Build and deployment**: Source = *Deploy from a branch*, Branch = `main` y carpeta `/ (root)` › **Save**.
4. En 1–2 minutos queda en `https://<usuario>.github.io/lb-labanda-apps/`.
5. Dominio propio (cuando lo compren): en **Settings › Pages › Custom domain** escribe `app.labandalb.com.co` y en el proveedor del dominio crea un registro **CNAME** `app` → `<usuario>.github.io`.

Cada cambio se publica subiendo de nuevo los archivos. Si cambias archivos de la app, sube también el número de versión en `cliente/sw.js` y `equipo/sw.js` (`lb-cliente-v1` → `v2`) para que los celulares tomen la versión nueva.

## Pendiente antes de producción

- Verificación del celular del cliente por código (SMS/WhatsApp). En QA y STAGING el cliente entra solo con su número.
- Pasarela de pagos (Wompi / Mercado Pago / Bold). Hoy los pedidos quedan *pendientes* y se pagan al recoger o contra entrega.
- Recordatorios por WhatsApp (se conectan con n8n leyendo la pestaña Citas).
- Las apps de tienda (Play Store / App Store) se pueden generar después desde esta misma PWA.
