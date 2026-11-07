/*
 * Configuración de ambientes.
 *  QA       → datos de prueba dentro del navegador (no toca Google Sheets). Para probar diseño y flujos.
 *  STAGING  → conectado a la COPIA de prueba de la hoja (LB La Banda – Base de datos STAGING) por su API.
 *  PROD     → conectado a la hoja real. Solo se activa cuando QA y STAGING estén aprobados.
 *
 * Para testers: agregar ?env=qa o ?env=staging al enlace cambia el ambiente en ese celular.
 */
window.LB_CONFIG = {
  ambientePorDefecto: 'QA',
  STAGING: {
    apiUrl: '',     // pega aquí la URL /exec de la API instalada en la hoja STAGING
    appToken: ''    // el mismo valor de API_TOKEN configurado en esa hoja
  },
  PROD: {
    apiUrl: '',
    appToken: ''
  }
};
