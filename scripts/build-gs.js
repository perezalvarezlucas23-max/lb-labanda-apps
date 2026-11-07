// Genera dist/lb-api.gs = lógica compartida + adaptador de Google Sheets (un solo archivo para pegar en Apps Script).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const logic = fs.readFileSync(path.join(root, 'shared/logic.js'), 'utf8')
  .replace(/\nif \(typeof module[^\n]*\n?/, '\n');
const adapter = fs.readFileSync(path.join(root, 'server/gs-adapter.js'), 'utf8');
const header = '/**\n * LB La Banda – API para Google Sheets. Archivo generado: no editar a mano.\n' +
  ' * Fuente: shared/logic.js + server/gs-adapter.js · Generado: ' + new Date().toISOString().slice(0, 10) + '\n */\n';
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/lb-api.gs'), header + logic + '\n' + adapter);
console.log('dist/lb-api.gs listo');
