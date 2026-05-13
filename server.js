'use strict';
const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CRR-Admin-2025';

// ── Database ──────────────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'training.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS completions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_name TEXT    NOT NULL,
    module_id     TEXT    NOT NULL,
    module_title  TEXT    NOT NULL,
    language      TEXT    NOT NULL DEFAULT 'en',
    date_completed TEXT,
    time_spent    TEXT,
    quiz_score    TEXT,
    certificate_html TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token      TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Training file paths ───────────────────────────────────────────────────────
const TRAINING_DIR = path.join(__dirname, 'training');

const MODULES = [
  // ── English ──────────────────────────────────────────────────────────────
  { id:'bbp_en',           lang:'en', title:'Bloodborne Pathogens',              icon:'☣️',  color:'#dc2626' },
  { id:'cyber_en',         lang:'en', title:'Cyber Security',                    icon:'🔐',  color:'#00d4ff' },
  { id:'disciplinary_en',  lang:'en', title:'Disciplinary Program',              icon:'⚖️',  color:'#f59e0b' },
  { id:'driving_en',       lang:'en', title:'Driving Safety',                    icon:'🚛',  color:'#3b82f6' },
  { id:'fall_en',          lang:'en', title:'Fall Protection',                   icon:'⛑️',  color:'#ef4444' },
  { id:'fire_en',          lang:'en', title:'Fire Protection & Extinguishers',   icon:'🧯',  color:'#f97316' },
  { id:'firstaid_en',      lang:'en', title:'First Aid',                         icon:'➕',  color:'#10b981' },
  { id:'tools_en',         lang:'en', title:'Hand & Power Tools',                icon:'🔧',  color:'#f97316' },
  { id:'hazcom_en',        lang:'en', title:'Hazard Communication (HazCom)',      icon:'⚗️',  color:'#8b5cf6' },
  { id:'ladder_en',        lang:'en', title:'Ladder Safety',                     icon:'🪜',  color:'#f59e0b' },
  { id:'ppe_en',           lang:'en', title:'Personal Protective Equipment',     icon:'🦺',  color:'#10b981' },
  { id:'rigging_en',       lang:'en', title:'Rigging Equipment',                 icon:'🏗️',  color:'#3b82f6' },
  { id:'scaffolds_en',     lang:'en', title:'Scaffolds',                         icon:'🏗️',  color:'#0ea5e9' },
  { id:'subcontractor_en', lang:'en', title:'Subcontractor Management',          icon:'🤝',  color:'#c9a227' },
  // ── Spanish ──────────────────────────────────────────────────────────────
  { id:'bbp_es',           lang:'es', title:'Patógenos de Transmisión Sanguínea', icon:'☣️', color:'#dc2626' },
  { id:'cyber_es',         lang:'es', title:'Seguridad Cibernética',               icon:'🔐', color:'#00d4ff' },
  { id:'disciplinary_es',  lang:'es', title:'Programa Disciplinario',              icon:'⚖️', color:'#f59e0b' },
  { id:'driving_es',       lang:'es', title:'Seguridad al Conducir',               icon:'🚛', color:'#3b82f6' },
  { id:'fall_es',          lang:'es', title:'Protección contra Caídas',            icon:'⛑️', color:'#ef4444' },
  { id:'fire_es',          lang:'es', title:'Protección contra Incendios',         icon:'🧯', color:'#f97316' },
  { id:'firstaid_es',      lang:'es', title:'Primeros Auxilios',                   icon:'➕', color:'#10b981' },
  { id:'tools_es',         lang:'es', title:'Herramientas Manuales y Eléctricas',  icon:'🔧', color:'#f97316' },
  { id:'hazcom_es',        lang:'es', title:'Comunicación de Riesgos (HazCom)',    icon:'⚗️', color:'#8b5cf6' },
  { id:'ladder_es',        lang:'es', title:'Seguridad en Escaleras',              icon:'🪜', color:'#f59e0b' },
  { id:'ppe_es',           lang:'es', title:'Equipo de Protección Personal (EPP)', icon:'🦺', color:'#10b981' },
  { id:'rigging_es',       lang:'es', title:'Equipo de Aparejo',                   icon:'🏗️', color:'#3b82f6' },
  { id:'scaffolds_es',     lang:'es', title:'Andamios',                            icon:'🏗️', color:'#0ea5e9' },
  { id:'subcontractor_es', lang:'es', title:'Gestión de Subcontratistas',           icon:'🤝', color:'#c9a227' },
];

const MODULE_MAP = {};
for (const m of MODULES) MODULE_MAP[m.id] = m;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Serve training modules with injected completion script ────────────────────
const INJECT_SCRIPT = `
<script>
(function(){
  var _origSubmitAck = window.submitAck;
  window.submitAck = function(){
    if (_origSubmitAck) _origSubmitAck.call(this);
    setTimeout(function(){
      var n = document.getElementById('cert-name') || document.getElementById('cn2');
      var d = document.getElementById('cert-date') || document.getElementById('cd');
      var t = document.getElementById('cert-time') || document.getElementById('ct');
      var s = document.getElementById('cert-score') || document.getElementById('cs');
      var c = document.getElementById('certificate') || document.getElementById('cert');
      var payload = {
        employeeName:    (n ? n.textContent : '') || '',
        moduleId:        window.__CRR_MODULE_ID__   || '',
        moduleTitle:     window.__CRR_MODULE_TITLE__ || document.title.split(' | ')[0],
        language:        window.__CRR_MODULE_LANG__  || 'en',
        dateCompleted:   d ? d.textContent : '',
        timeSpent:       t ? t.textContent : '',
        quizScore:       s ? s.textContent : '',
        certificateHTML: c ? c.outerHTML   : ''
      };
      fetch('/api/complete', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      })
      .then(function(r){ return r.json(); })
      .then(function(res){
        window.__CRR_COMPLETION_ID__ = res.id;
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type:'trainingComplete', payload:payload, id:res.id }, '*');
        }
      })
      .catch(function(e){ console.warn('[CRR Portal] Save error:', e); });
    }, 900);
  };
})();
</script>
`;

app.get('/training/:moduleId', (req, res) => {
  const mod = MODULE_MAP[req.params.moduleId];
  if (!mod) return res.status(404).send('Module not found');
  const filePath = path.join(TRAINING_DIR, `${mod.id}.html`);
  if (!fs.existsSync(filePath)) return res.status(404).send(`Training file not found: ${mod.id}.html`);

  let html = fs.readFileSync(filePath, 'utf-8');
  const metaScript = `<script>window.__CRR_MODULE_ID__='${mod.id}';window.__CRR_MODULE_TITLE__=${JSON.stringify(mod.title)};window.__CRR_MODULE_LANG__='${mod.lang}';</script>`;
  // Inject meta before </head> and completion hook before </body>
  html = html.replace('</head>', metaScript + '</head>');
  html = html.replace('</body>', INJECT_SCRIPT + '</body>');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ── Public API: module list ───────────────────────────────────────────────────
app.get('/api/modules', (req, res) => {
  res.json(MODULES.map(({ id, lang, title, icon, color }) => ({ id, lang, title, icon, color })));
});

// ── Public API: save completion ───────────────────────────────────────────────
app.post('/api/complete', (req, res) => {
  const { employeeName, moduleId, moduleTitle, language, dateCompleted, timeSpent, quizScore, certificateHTML } = req.body;
  if (!employeeName || !moduleTitle) return res.status(400).json({ error: 'Missing required fields' });
  const r = db.prepare(`
    INSERT INTO completions (employee_name, module_id, module_title, language, date_completed, time_spent, quiz_score, certificate_html)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(employeeName, moduleId||'', moduleTitle, language||'en', dateCompleted||'', timeSpent||'', quizScore||'', certificateHTML||'');
  res.json({ success: true, id: r.lastInsertRowid });
});

// ── Admin auth ────────────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  if ((req.body.password || '') !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid password' });
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO admin_sessions (token) VALUES (?)').run(token);
  res.json({ token });
});

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token || req.query._t || '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  if (!db.prepare('SELECT 1 FROM admin_sessions WHERE token=?').get(token)) return res.status(401).json({ error: 'Invalid token' });
  next();
}

// ── Admin: list completions ───────────────────────────────────────────────────
app.get('/api/admin/completions', adminAuth, (req, res) => {
  const { employee, module: mod, language, from, to, limit = 500, offset = 0 } = req.query;
  let q = 'SELECT id,employee_name,module_id,module_title,language,date_completed,time_spent,quiz_score,created_at FROM completions WHERE 1=1';
  const p = [];
  if (employee) { q += ' AND employee_name LIKE ?'; p.push(`%${employee}%`); }
  if (mod)      { q += ' AND (module_title LIKE ? OR module_id LIKE ?)'; p.push(`%${mod}%`, `%${mod}%`); }
  if (language) { q += ' AND language=?'; p.push(language); }
  if (from)     { q += ' AND date(created_at)>=?'; p.push(from); }
  if (to)       { q += ' AND date(created_at)<=?'; p.push(to); }
  q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  p.push(Number(limit), Number(offset));
  res.json(db.prepare(q).all(...p));
});

// ── Admin: stats ──────────────────────────────────────────────────────────────
app.get('/api/admin/stats', adminAuth, (req, res) => {
  const total    = db.prepare('SELECT COUNT(*) AS c FROM completions').get().c;
  const people   = db.prepare('SELECT COUNT(DISTINCT employee_name) AS c FROM completions').get().c;
  const thisMonth= db.prepare("SELECT COUNT(*) AS c FROM completions WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now')").get().c;
  const today    = db.prepare("SELECT COUNT(*) AS c FROM completions WHERE date(created_at)=date('now')").get().c;
  const modules  = db.prepare('SELECT module_title, COUNT(*) AS c FROM completions GROUP BY module_title ORDER BY c DESC LIMIT 5').all();
  res.json({ total, people, thisMonth, today, topModules: modules });
});

// ── Admin: get certificate page ───────────────────────────────────────────────
app.get('/api/admin/certificate/:id', adminAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM completions WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(buildCertPage(row));
});

// ── Admin: delete record ──────────────────────────────────────────────────────
app.delete('/api/admin/completions/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM completions WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── Admin: export CSV ─────────────────────────────────────────────────────────
app.get('/api/admin/export', adminAuth, (req, res) => {
  const rows = db.prepare('SELECT id,employee_name,module_title,language,date_completed,time_spent,quiz_score,created_at FROM completions ORDER BY created_at DESC').all();
  const esc  = v => `"${String(v||'').replace(/"/g,'""')}"`;
  const csv  = [
    'ID,Employee Name,Module Title,Language,Date Completed,Time Spent,Quiz Score,Recorded At',
    ...rows.map(r => [r.id, esc(r.employee_name), esc(r.module_title), r.language, esc(r.date_completed), esc(r.time_spent), esc(r.quiz_score), esc(r.created_at)].join(','))
  ].join('\r\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="CRR_Training_Records.csv"');
  res.send(csv);
});

// ── Certificate page builder ──────────────────────────────────────────────────
function buildCertPage(row) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Certificate – ${row.employee_name} – ${row.module_title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#1a1208;color:#e8e8e8;min-height:100vh}
.toolbar{background:#111;padding:14px 24px;display:flex;align-items:center;gap:16px;border-bottom:1px solid #2a2a2a}
.toolbar h2{color:#c9a227;font-size:1em;flex:1}
.toolbar button{background:linear-gradient(135deg,#c9a227,#f5c842);color:#111;border:none;padding:10px 22px;border-radius:8px;font-size:0.9em;font-weight:700;cursor:pointer}
.cert-wrap{display:flex;align-items:center;justify-content:center;padding:40px;min-height:calc(100vh - 57px)}
/* ── Both certificate ID schemes ── */
#certificate,#cert{
  position:relative;background:linear-gradient(160deg,#0e0e0e 0%,#181208 50%,#0e0e0e 100%);
  border:3px double #c9a227;border-radius:14px;padding:36px 40px;max-width:800px;width:100%;overflow:hidden
}
#certificate::before,#cert::before{
  content:'';position:absolute;top:8px;left:8px;right:8px;bottom:8px;
  border:1px solid rgba(201,162,39,0.25);border-radius:10px;pointer-events:none
}
/* English template classes */
.cert-logo-row,.clr{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.cert-logo,.cl{width:64px;height:64px;object-fit:contain}
.cert-co,.cc{font-size:0.85em;font-weight:700;color:#c9a227;letter-spacing:2px;text-transform:uppercase;text-align:center}
.cert-title-block,.ctb{margin:10px 0 22px;text-align:center}
.cert-presents,.cp{font-size:0.8em;letter-spacing:3px;color:#888;text-transform:uppercase}
.cert-award,.ca{font-size:2rem;font-weight:900;background:linear-gradient(135deg,#f5c842,#c9a227);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:6px 0 10px}
.cert-module,.cm{font-size:1rem;color:#b0a080;letter-spacing:1px}
.cert-divider,.cd{border:none;border-top:1px solid rgba(201,162,39,0.3);margin:18px 0}
.cert-name-label,.cnl{font-size:0.75em;color:#888;letter-spacing:2px;text-transform:uppercase;text-align:center}
.cert-name,.cn{font-size:1.85rem;font-weight:700;color:#f0e0a0;font-style:italic;margin:4px 0 18px;text-align:center}
.cert-meta-row,.cmr{display:flex;justify-content:center;gap:30px;flex-wrap:wrap;margin:14px 0}
.cert-meta,.cmt{text-align:center}
.cert-meta-label,.cmtl{font-size:0.7em;color:#777;letter-spacing:1px;text-transform:uppercase}
.cert-meta-val,.cmtv{font-size:0.9em;color:#c0b070;font-weight:600}
.cert-badges,.cbg{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:18px 0}
.cert-badge,.cbg2{background:rgba(201,162,39,0.12);border:1px solid rgba(201,162,39,0.4);color:#c9a227;border-radius:20px;padding:5px 13px;font-size:0.72em;font-weight:600}
.cert-footer,.cf{display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;padding-top:14px;border-top:1px solid rgba(201,162,39,0.2)}
@media print{
  .toolbar{display:none}
  body{background:#fff}
  .cert-wrap{padding:20px;min-height:auto}
  #certificate,#cert{border-color:#c9a227!important}
  .cert-award,.ca{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .cert-badge,.cbg2{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style>
</head>
<body>
<div class="toolbar">
  <h2>Certificate of Completion — ${row.employee_name} — ${row.module_title}</h2>
  <button onclick="window.print()">🖨️ Print / Save as PDF</button>
  <button onclick="window.close()" style="background:#333;color:#ccc">✕ Close</button>
</div>
<div class="cert-wrap">${row.certificate_html || '<p style="color:#888;text-align:center">Certificate data unavailable for this record.</p>'}</div>
</body>
</html>`;
}

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  const ifaces = require('os').networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) { localIP = iface.address; break; }
    }
  }
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   CRR Safety Training Portal — RUNNING               ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Local:    http://localhost:${PORT}                      ║`);
  console.log(`║  Network:  http://${localIP}:${PORT}                  ║`);
  console.log(`║  Admin:    http://localhost:${PORT}/admin.html            ║`);
  console.log(`║  Password: ${ADMIN_PASSWORD.padEnd(42)}║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');
});
