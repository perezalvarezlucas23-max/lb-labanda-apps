# Plan de pruebas – Ambiente QA

**Objetivo:** confirmar que el diseño y todos los flujos funcionan antes de conectar la hoja STAGING.
**Datos:** ficticios, se guardan solo en el celular o computador donde se prueba. El botón **Reiniciar** de la franja amarilla los deja como al inicio.
**Usuarios de prueba:** botón **Usuarios de prueba** en la franja amarilla.

| Rol | Celular | Clave |
| --- | --- | --- |
| Administrador | 3000000000 | 0000 |
| Barbero QA 1 / 2 / 3 | 3000000001 / 02 / 03 | 1111 / 2222 / 3333 |
| Barbero QA 4 (agenda pausada) | 3000000004 | 4444 |
| Cliente QA | 3100000001 | (sin clave) |

> Para probar cliente y equipo con los mismos datos, ábrelos **en el mismo navegador** (pestañas distintas).

## 1. Pruebas automáticas (las corre el equipo técnico)

`npm test` debe terminar sin fallas:

- **Lógica** (13 casos): disponibilidad por barbero, descanso, duración del servicio, horas pasadas, domingo, agenda pausada, doble reserva, sede del barbero, roles, comisión, puntos, PIN, primer ingreso del admin, compras, totales por sede y barbero.
- **API de Google Sheets simulada** (1 flujo): el mismo archivo `dist/lb-api.gs` que se pega en la hoja, con fechas y horas como las guarda Google Sheets.
- **Punta a punta en navegador** (1 flujo largo): registro de cliente → reserva Corte Premium → la hora desaparece para otros → compra en tienda → barbero entra (clave errada y correcta) → marca atendida → pausa agenda → admin filtra por rango, barbero y sede → cambia precio → el cliente ve el precio nuevo y al barbero no disponible. Deja capturas en `tests/capturas/`.

## 2. Pruebas manuales en celulares (Android y iPhone)

Marca cada caso en los dos sistemas.

### App La Banda (clientes)
| # | Caso | Resultado esperado | Android | iPhone |
| --- | --- | --- | --- | --- |
| C1 | Instalar desde el enlace | Ícono LB en la pantalla de inicio, abre sin barra del navegador | ☐ | ☐ |
| C2 | Registro con celular nuevo sin nombre | Pide el nombre | ☐ | ☐ |
| C3 | Reserva completa: sede → servicio → barbero → hora → confirmar | Pantalla "¡Listo! Te esperamos" | ☐ | ☐ |
| C4 | Perfil del barbero | Foto/iniciales, especialidades y 3 próximos espacios | ☐ | ☐ |
| C5 | Cambiar de barbero en el horario | Las horas libres cambian según el barbero | ☐ | ☐ |
| C6 | "Cualquier barbero disponible" | Muestra todas las horas y asigna un barbero | ☐ | ☐ |
| C7 | Barbero QA 4 | Aparece "Hoy no atiende" y no deja reservar | ☐ | ☐ |
| C8 | Agregar a mi calendario | Descarga la cita y se abre en el calendario | ☐ | ☐ |
| C9 | Cancelar una cita desde Perfil | Queda cancelada y la hora vuelve a estar libre | ☐ | ☐ |
| C10 | Tienda: agregar, cambiar cantidades, pedido para recoger y a domicilio | Pedido queda *Pendiente* en Perfil | ☐ | ☐ |
| C11 | Puntos | Suben cuando el barbero marca atendida o el admin marca pagado | ☐ | ☐ |
| C12 | Sin señal (modo avión) después de abrirla una vez | La app abre y muestra error amable al cargar datos | ☐ | ☐ |

### App LB Equipo – barbero
| # | Caso | Resultado esperado | Android | iPhone |
| --- | --- | --- | --- | --- |
| B1 | Ingreso con clave errada / correcta | Mensaje de error / entra a Mi agenda | ☐ | ☐ |
| B2 | Pausar y activar la agenda | El cliente deja de ver / vuelve a ver al barbero | ☐ | ☐ |
| B3 | Marcar atendida | Suma a "Atendidas" y a la comisión | ☐ | ☐ |
| B4 | Marcar no asistió | Pide confirmación y queda registrado | ☐ | ☐ |
| B5 | Mi control: Hoy / Semana / Mes | Totales cambian según el periodo | ☐ | ☐ |
| B6 | Horarios: apagar un día y guardar | Ese día ya no ofrece horas al cliente | ☐ | ☐ |
| B7 | Bloquear un horario puntual | Esas horas desaparecen para el cliente | ☐ | ☐ |
| B8 | Un barbero intenta ver datos de admin | No tiene el menú ni el acceso | ☐ | ☐ |

### App LB Equipo – administrador (celular y computador)
| # | Caso | Resultado esperado | Celular | Computador |
| --- | --- | --- | --- | --- |
| A1 | Control general con filtros de sede, barbero y periodo | Totales y tablas cambian y cuadran | ☐ | ☐ |
| A2 | Exportar a Excel (CSV) | Se descarga y abre en Excel con tildes correctas | ☐ | ☐ |
| A3 | Agendas: ver la de cada barbero y marcar citas | Funciona igual que en la app del barbero | ☐ | ☐ |
| A4 | Registrar barbero nuevo con clave | El barbero puede entrar con esa clave | ☐ | ☐ |
| A5 | Celular repetido | Avisa "Ese celular ya está registrado" | ☐ | ☐ |
| A6 | Cambiar precio y duración del Corte Premium | El cliente ve el precio nuevo y la duración cambia las horas | ☐ | ☐ |
| A7 | Pedidos: marcar pagado | Suma puntos al cliente | ☐ | ☐ |
| A8 | Editar sede | El cliente ve los datos nuevos | ☐ | ☐ |

## 3. Criterios para pasar a STAGING

- [ ] `npm test` sin fallas.
- [ ] Todos los casos de las tablas en ✓ (o con su ajuste acordado).
- [ ] Aprobación de los dueños sobre diseño y textos.
- [ ] Decidido: comisión por barbero, precios y duraciones reales, horarios reales.

Registro de hallazgos: anota número de caso, celular usado, qué pasó y captura de pantalla.
