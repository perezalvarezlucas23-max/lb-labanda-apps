# Guía STAGING – conectar la hoja de pruebas

STAGING usa la hoja **LB La Banda – Base de datos STAGING** (copia de la real, ya creada en el Drive). Así se prueba con Google Sheets de verdad sin tocar la hoja que se usará en producción.

## 1. Preparar la hoja STAGING (10 min)

1. Abre **LB La Banda – Base de datos STAGING** en Google Drive.
2. Pestaña **Sedes**: nombres y direcciones de las dos sedes.
3. Pestaña **Equipo**: en la fila `ADM1` escribe el **celular del administrador**. Los barberos se pueden registrar después desde la app (Barberos › Registrar).
4. Pestaña **Servicios**: precio y duración de Corte, Barba, Corte + Barba y Corte Premium (o déjalo para hacerlo desde la app).
5. Pestaña **Horarios**: horas de entrada y salida por día de cada barbero (o que cada barbero lo haga desde su app en *Horarios*).

## 2. Instalar la API (15 min)

1. En la hoja: **Extensiones › Apps Script**.
2. Borra lo que aparezca en `Código.gs` y pega **todo** el archivo `dist/lb-api.gs`. Guarda (ícono de disquete).
3. **Configuración del proyecto** (engranaje) › **Propiedades del script** › **Agregar propiedad**:
   - Propiedad: `API_TOKEN`
   - Valor: una clave larga inventada, por ejemplo `labanda-staging-7f3k9q2x` (no la compartas fuera del equipo).
4. Vuelve al editor, elige la función **probarInstalacion** y presiona **Ejecutar**. Google pedirá permisos: *Revisar permisos › tu cuenta › Configuración avanzada › Ir a… › Permitir*. En el registro deben salir todas las pestañas y `API_TOKEN configurado: true`.
5. **Implementar › Nueva implementación** › tipo **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).

> Cada vez que se cambie `lb-api.gs`: **Implementar › Administrar implementaciones › editar (lápiz) › Versión: Nueva versión**. Así la URL no cambia.

## 3. Conectar las apps

En `shared/config.js`:

```js
STAGING: {
  apiUrl: 'https://script.google.com/macros/s/XXXXXXXX/exec',
  appToken: 'labanda-staging-7f3k9q2x'
},
```

Sube el archivo a GitHub. Los testers abren:

- `https://<usuario>.github.io/lb-labanda-apps/cliente/?env=staging`
- `https://<usuario>.github.io/lb-labanda-apps/equipo/?env=staging`

La franja azul **STAGING** confirma que están conectados a la hoja de pruebas.

## 4. Primer ingreso del administrador

En LB Equipo escribe el celular que pusiste en `ADM1` y **crea una clave de 4 a 8 números**: queda guardada (cifrada) en la hoja. Desde ahí el administrador registra a los barberos con su propia clave.

## 5. Qué probar en STAGING

- Repetir el [plan de QA](PLAN-QA.md) con el equipo real durante 1–2 semanas, con reservas de prueba.
- Comparar la pestaña **Resumen** de la hoja con el **Control general** de la app para el mismo periodo: deben dar lo mismo.
- Dos celulares intentando reservar la misma hora al mismo tiempo: solo uno debe lograrlo.
- Velocidad: cada acción debe responder en 1–3 segundos (Google Apps Script es más lento que QA).

## 6. Pasar a producción

1. Repetir el paso 2 en la hoja **LB La Banda – Base de datos** (la original), con **otro** `API_TOKEN`.
2. En `shared/config.js` llenar `PROD` y cambiar `ambientePorDefecto: 'PROD'`.
3. Subir versión en `cliente/sw.js` y `equipo/sw.js` y publicar.
4. Borrar de la hoja STAGING los datos de prueba si se va a seguir usando.

## Seguridad y límites

- La hoja **no** se comparte públicamente; solo la API entra a ella.
- La clave `API_TOKEN` viaja dentro de la app (como toda app web), por eso cada acción además exige **sesión** y **rol**: un cliente no puede ver datos de otro ni del administrador, y un barbero solo ve su agenda.
- Las claves del equipo se guardan cifradas (SHA-256), nunca en texto.
- Las sesiones duran 6 horas.
- Google Apps Script gratis aguanta bien el volumen de dos sedes. Si crece mucho (más sedes, miles de citas al mes) se migra a PostgreSQL como dice el documento de arquitectura; las tablas ya tienen las mismas columnas.
