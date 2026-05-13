'use strict';
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CRR-Admin-2025';

// ── Password utilities (built-in crypto, no extra deps) ───────────────────────
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(pw, stored) {
  try {
    const [salt, hash] = stored.split(':');
    const h = crypto.scryptSync(pw, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(h, 'hex'));
  } catch(e) { return false; }
}

// ── Optional email (nodemailer via Gmail, set EMAIL_USER + EMAIL_PASS env vars) ─
let mailer = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  try {
    const nodemailer = require('nodemailer');
    mailer = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    console.log('[CRR] Email notifications enabled:', process.env.EMAIL_USER);
  } catch(e) { console.warn('[CRR] nodemailer not available:', e.message); }
}

// ── Database (PostgreSQL on Railway, SQLite locally) ──────────────────────────
let query;

if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  query = async (sql, params = []) => {
    let n = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++n}`);
    const { rows } = await pool.query(pgSql, params);
    return rows;
  };
  (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS completions (
        id               SERIAL PRIMARY KEY,
        employee_name    TEXT NOT NULL,
        module_id        TEXT NOT NULL DEFAULT '',
        module_title     TEXT NOT NULL,
        language         TEXT NOT NULL DEFAULT 'en',
        date_completed   TEXT,
        time_spent       TEXT,
        quiz_score       TEXT,
        certificate_html TEXT,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token      TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS employees (
        id            SERIAL PRIMARY KEY,
        name          TEXT NOT NULL,
        email         TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS employee_sessions (
        token       TEXT PRIMARY KEY,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Add employee_id to completions if this is an existing DB
    await pool.query(`ALTER TABLE completions ADD COLUMN IF NOT EXISTS employee_id INT REFERENCES employees(id)`);
    console.log('[CRR] PostgreSQL tables ready');
  })().catch(e => console.error('[CRR] DB init error:', e));

} else {
  const Database = require('better-sqlite3');
  const DB_PATH  = path.join(__dirname, 'data', 'training.db');
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS completions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_name    TEXT NOT NULL,
      module_id        TEXT NOT NULL DEFAULT '',
      module_title     TEXT NOT NULL,
      language         TEXT NOT NULL DEFAULT 'en',
      date_completed   TEXT,
      time_spent       TEXT,
      quiz_score       TEXT,
      certificate_html TEXT,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token      TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS employees (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS employee_sessions (
      token       TEXT PRIMARY KEY,
      employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Add employee_id column to completions if it doesn't exist yet
  try { db.exec('ALTER TABLE completions ADD COLUMN employee_id INTEGER REFERENCES employees(id)'); } catch(e) {}
  query = async (sql, params = []) => {
    const stmt = db.prepare(sql);
    if (/^\s*(insert|update|delete)/i.test(sql)) {
      const r = stmt.run(...params);
      return [{ id: r.lastInsertRowid, changes: r.changes }];
    }
    return stmt.all(...params);
  };
  console.log('[CRR] SQLite ready:', DB_PATH);
}

// ── Training modules ──────────────────────────────────────────────────────────
const TRAINING_DIR = path.join(__dirname, 'training');

const MODULES = [
  { id:'bbp_en',           lang:'en', title:'Bloodborne Pathogens',               icon:'☣️',  color:'#dc2626' },
  { id:'cyber_en',         lang:'en', title:'Cyber Security',                     icon:'🔐',  color:'#00d4ff' },
  { id:'disciplinary_en',  lang:'en', title:'Disciplinary Program',               icon:'⚖️',  color:'#f59e0b' },
  { id:'driving_en',       lang:'en', title:'Driving Safety',                     icon:'🚛',  color:'#3b82f6' },
  { id:'fall_en',          lang:'en', title:'Fall Protection',                    icon:'⛑️',  color:'#ef4444' },
  { id:'fire_en',          lang:'en', title:'Fire Protection & Extinguishers',    icon:'🧯',  color:'#f97316' },
  { id:'firstaid_en',      lang:'en', title:'First Aid',                          icon:'➕',  color:'#10b981' },
  { id:'tools_en',         lang:'en', title:'Hand & Power Tools',                 icon:'🔧',  color:'#f97316' },
  { id:'hazcom_en',        lang:'en', title:'Hazard Communication (HazCom)',       icon:'⚗️',  color:'#8b5cf6' },
  { id:'ladder_en',        lang:'en', title:'Ladder Safety',                      icon:'🪜',  color:'#f59e0b' },
  { id:'ppe_en',           lang:'en', title:'Personal Protective Equipment',      icon:'🦺',  color:'#10b981' },
  { id:'rigging_en',       lang:'en', title:'Rigging Equipment',                  icon:'🏗️',  color:'#3b82f6' },
  { id:'scaffolds_en',     lang:'en', title:'Scaffolds',                          icon:'🏗️',  color:'#0ea5e9' },
  { id:'subcontractor_en', lang:'en', title:'Subcontractor Management',           icon:'🤝',  color:'#c9a227' },
  { id:'bbp_es',           lang:'es', title:'Patógenos de Transmisión Sanguínea', icon:'☣️',  color:'#dc2626' },
  { id:'cyber_es',         lang:'es', title:'Seguridad Cibernética',              icon:'🔐',  color:'#00d4ff' },
  { id:'disciplinary_es',  lang:'es', title:'Programa Disciplinario',             icon:'⚖️',  color:'#f59e0b' },
  { id:'driving_es',       lang:'es', title:'Seguridad al Conducir',              icon:'🚛',  color:'#3b82f6' },
  { id:'fall_es',          lang:'es', title:'Protección contra Caídas',           icon:'⛑️',  color:'#ef4444' },
  { id:'fire_es',          lang:'es', title:'Protección contra Incendios',        icon:'🧯',  color:'#f97316' },
  { id:'firstaid_es',      lang:'es', title:'Primeros Auxilios',                  icon:'➕',  color:'#10b981' },
  { id:'tools_es',         lang:'es', title:'Herramientas Manuales y Eléctricas', icon:'🔧',  color:'#f97316' },
  { id:'hazcom_es',        lang:'es', title:'Comunicación de Riesgos (HazCom)',   icon:'⚗️',  color:'#8b5cf6' },
  { id:'ladder_es',        lang:'es', title:'Seguridad en Escaleras',             icon:'🪜',  color:'#f59e0b' },
  { id:'ppe_es',           lang:'es', title:'Equipo de Protección Personal (EPP)',icon:'🦺',  color:'#10b981' },
  { id:'rigging_es',       lang:'es', title:'Equipo de Aparejo',                  icon:'🏗️',  color:'#3b82f6' },
  { id:'scaffolds_es',     lang:'es', title:'Andamios',                           icon:'🏗️',  color:'#0ea5e9' },
  { id:'subcontractor_es', lang:'es', title:'Gestión de Subcontratistas',         icon:'🤝',  color:'#c9a227' },
];
const MODULE_MAP = Object.fromEntries(MODULES.map(m => [m.id, m]));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Completion injection script ───────────────────────────────────────────────
const INJECT_SCRIPT = `
<script>
(function(){
  // Create hidden placeholder elements for removed time-spent IDs so
  // submitAck doesn't crash trying to set them (which would block tracking).
  ['cert-time','pcert-time','ct','print-time'].forEach(function(id){
    if(!document.getElementById(id)){
      var d=document.createElement('div');
      d.id=id;d.style.display='none';
      document.body.appendChild(d);
    }
  });

  function getText(ids){
    for(var i=0;i<ids.length;i++){
      var el=document.getElementById(ids[i]);
      if(el&&el.textContent.trim()&&el.textContent.trim()!=='—') return el.textContent.trim();
    }
    return '';
  }
  function getEl(ids){
    for(var i=0;i<ids.length;i++){var el=document.getElementById(ids[i]);if(el) return el;}
    return null;
  }

  function sendCompletion(){
    var name=getText(['cert-name','cert-employee-name','cn2'])||window.employeeName||'';
    var date=getText(['cert-date','cert-date-out','cd']);
    var score=getText(['cert-score','cs']);
    var certEl=getEl(['certificate','cert-card','cert']);
    var payload={
      employeeName:    name,
      moduleId:        window.__CRR_MODULE_ID__||'',
      moduleTitle:     window.__CRR_MODULE_TITLE__||document.title,
      language:        window.__CRR_MODULE_LANG__||'en',
      dateCompleted:   date,
      quizScore:       score,
      certificateHTML: certEl?certEl.outerHTML:''
    };
    // Include employee token if the user is logged in (same origin = same localStorage)
    var headers={'Content-Type':'application/json'};
    try{var et=localStorage.getItem('crr_employee_token');if(et) headers['x-employee-token']=et;}catch(e){}
    console.log('[CRR] Sending completion:', payload.moduleTitle, payload.employeeName);
    fetch('/api/complete',{
      method:'POST',
      headers:headers,
      body:JSON.stringify(payload)
    })
    .then(function(r){return r.json();})
    .then(function(res){
      console.log('[CRR] Saved, id:', res.id);
      window.__CRR_COMPLETION_ID__=res.id;
      if(window.parent&&window.parent!==window){
        window.parent.postMessage({type:'trainingComplete',payload:payload,id:res.id},'*');
      }
    })
    .catch(function(e){console.warn('[CRR] Save error:',e);});
  }

  var _orig=window.submitAck;
  window.submitAck=function(){
    try{ if(_orig) _orig.call(this); }catch(e){ console.warn('[CRR] submitAck error (non-fatal):',e); }
    setTimeout(sendCompletion,1500);
  };
})();
</script>
`;

// ── Serve training modules ────────────────────────────────────────────────────
app.get('/training/:moduleId', (req, res) => {
  const mod = MODULE_MAP[req.params.moduleId];
  if (!mod) return res.status(404).send('Module not found');
  const filePath = path.join(TRAINING_DIR, `${mod.id}.html`);
  if (!fs.existsSync(filePath)) return res.status(404).send(`File not found: ${mod.id}.html`);
  let html = fs.readFileSync(filePath, 'utf-8');
  const meta = `<script>window.__CRR_MODULE_ID__='${mod.id}';window.__CRR_MODULE_TITLE__=${JSON.stringify(mod.title)};window.__CRR_MODULE_LANG__='${mod.lang}';</script>`;
  html = html.replace('</head>', meta + '</head>');
  html = html.replace('</body>', INJECT_SCRIPT + '</body>');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ── Public: module list ───────────────────────────────────────────────────────
app.get('/api/modules', (req, res) => {
  res.json(MODULES.map(({ id, lang, title, icon, color }) => ({ id, lang, title, icon, color })));
});

// ── Public: save completion ───────────────────────────────────────────────────
app.post('/api/complete', async (req, res) => {
  try {
    const { employeeName, moduleId, moduleTitle, language, dateCompleted, quizScore, certificateHTML } = req.body;
    console.log('[CRR] /api/complete:', { employeeName, moduleId, moduleTitle, language });
    if (!moduleTitle) return res.status(400).json({ error: 'Missing moduleTitle' });
    const name = (employeeName || '').trim() || 'Unknown';

    // Link to logged-in employee if token provided
    let employeeId = null;
    const empToken = req.headers['x-employee-token'] || '';
    if (empToken) {
      const empRows = await query('SELECT employee_id FROM employee_sessions WHERE token=?', [empToken]);
      if (empRows.length) employeeId = empRows[0].employee_id;
    }

    const rows = await query(
      `INSERT INTO completions (employee_name,module_id,module_title,language,date_completed,quiz_score,certificate_html,employee_id) VALUES (?,?,?,?,?,?,?,?)`,
      [name, moduleId||'', moduleTitle, language||'en', dateCompleted||'', quizScore||'', certificateHTML||'', employeeId]
    );
    const id = rows[0]?.id || rows[0]?.lastInsertRowid || 0;
    console.log('[CRR] Saved completion id:', id, 'for', name, employeeId ? `(employee ${employeeId})` : '(anonymous)');
    res.json({ success: true, id });
  } catch(e) {
    console.error('[CRR] /api/complete error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Employee auth ─────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const existing = await query('SELECT id FROM employees WHERE email=?', [email.toLowerCase().trim()]);
    if (existing.length) return res.status(409).json({ error: 'That email is already registered. Please sign in.' });
    const hash = hashPassword(password);
    const rows = await query(
      'INSERT INTO employees (name,email,password_hash) VALUES (?,?,?)',
      [name.trim(), email.toLowerCase().trim(), hash]
    );
    const employeeId = rows[0]?.id || rows[0]?.lastInsertRowid;
    const token = crypto.randomBytes(32).toString('hex');
    await query('INSERT INTO employee_sessions (token,employee_id) VALUES (?,?)', [token, employeeId]);
    res.json({ token, name: name.trim(), email: email.toLowerCase().trim() });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const rows = await query('SELECT * FROM employees WHERE email=?', [email.toLowerCase().trim()]);
    if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    await query('INSERT INTO employee_sessions (token,employee_id) VALUES (?,?)', [token, rows[0].id]);
    res.json({ token, name: rows[0].name, email: rows[0].email });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

async function employeeAuth(req, res, next) {
  const token = req.headers['x-employee-token'] || req.query.et || '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const rows = await query(
    'SELECT e.id,e.name,e.email FROM employees e JOIN employee_sessions es ON e.id=es.employee_id WHERE es.token=?',
    [token]
  );
  if (!rows.length) return res.status(401).json({ error: 'Invalid token' });
  req.employee = rows[0];
  next();
}

app.get('/api/auth/me', employeeAuth, (req, res) => {
  res.json({ id: req.employee.id, name: req.employee.name, email: req.employee.email });
});

app.post('/api/auth/logout', employeeAuth, async (req, res) => {
  const token = req.headers['x-employee-token'] || '';
  await query('DELETE FROM employee_sessions WHERE token=?', [token]);
  res.json({ success: true });
});

// ── Employee: own completions with expiry ─────────────────────────────────────
app.get('/api/employee/completions', employeeAuth, async (req, res) => {
  try {
    const rows = await query(
      'SELECT id,module_id,module_title,language,date_completed,quiz_score,created_at FROM completions WHERE employee_id=? ORDER BY created_at DESC',
      [req.employee.id]
    );
    const now = Date.now();
    const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    const result = rows.map(r => {
      const completedAt = new Date(r.created_at).getTime();
      const expiryAt    = completedAt + YEAR_MS;
      const daysLeft    = Math.ceil((expiryAt - now) / (24 * 60 * 60 * 1000));
      return {
        ...r,
        expiry_date: new Date(expiryAt).toISOString().split('T')[0],
        days_left:   daysLeft,
        status:      daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'expiring_soon' : 'active'
      };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Admin auth ────────────────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  if ((req.body.password || '') !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid password' });
  const token = crypto.randomBytes(32).toString('hex');
  await query('INSERT INTO admin_sessions (token) VALUES (?)', [token]);
  res.json({ token });
});

async function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token || req.query._t || '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const rows = await query('SELECT 1 FROM admin_sessions WHERE token=?', [token]);
  if (!rows.length) return res.status(401).json({ error: 'Invalid token' });
  next();
}

// ── Admin: completions ────────────────────────────────────────────────────────
app.get('/api/admin/completions', adminAuth, async (req, res) => {
  try {
    const { employee, module: mod, language, from, to, limit = 500, offset = 0 } = req.query;
    let q = 'SELECT id,employee_name,module_id,module_title,language,date_completed,quiz_score,created_at FROM completions WHERE 1=1';
    const p = [];
    if (employee) { q += ' AND employee_name ILIKE ?'; p.push(`%${employee}%`); }
    if (mod)      { q += ' AND (module_title ILIKE ? OR module_id ILIKE ?)'; p.push(`%${mod}%`,`%${mod}%`); }
    if (language) { q += ' AND language=?'; p.push(language); }
    if (from)     { q += ' AND created_at>=?'; p.push(from); }
    if (to)       { q += ' AND created_at<=?'; p.push(to+'T23:59:59'); }
    q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    p.push(Number(limit), Number(offset));
    res.json(await query(q, p));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: stats ──────────────────────────────────────────────────────────────
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const isPg = !!process.env.DATABASE_URL;
    const [r1] = await query('SELECT COUNT(*) AS c FROM completions');
    const [r2] = await query('SELECT COUNT(DISTINCT employee_name) AS c FROM completions');
    const [r3] = isPg
      ? await query(`SELECT COUNT(*) AS c FROM completions WHERE created_at >= date_trunc('month', NOW())`)
      : await query("SELECT COUNT(*) AS c FROM completions WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now')");
    const [r4] = isPg
      ? await query(`SELECT COUNT(*) AS c FROM completions WHERE created_at >= CURRENT_DATE`)
      : await query("SELECT COUNT(*) AS c FROM completions WHERE date(created_at)=date('now')");
    const [r5] = await query('SELECT COUNT(*) AS c FROM employees');
    const topModules = await query('SELECT module_title, COUNT(*) AS c FROM completions GROUP BY module_title ORDER BY c DESC LIMIT 5');
    res.json({
      total:      Number(r1.c),
      people:     Number(r2.c),
      thisMonth:  Number(r3.c),
      today:      Number(r4.c),
      employees:  Number(r5.c),
      topModules: topModules.map(r => ({ module_title: r.module_title, c: Number(r.c) }))
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: expiring certifications ────────────────────────────────────────────
app.get('/api/admin/expiring', adminAuth, async (req, res) => {
  try {
    const isPg = !!process.env.DATABASE_URL;
    const days = Number(req.query.days || 30);
    let rows;
    if (isPg) {
      rows = await query(`
        SELECT DISTINCT ON (employee_name, module_id)
               id, employee_name, module_id, module_title, language, created_at,
               (created_at + INTERVAL '1 year')::DATE AS expiry_date,
               CEIL(EXTRACT(EPOCH FROM ((created_at + INTERVAL '1 year') - NOW())) / 86400)::INT AS days_left
        FROM completions
        WHERE (created_at + INTERVAL '1 year') BETWEEN NOW() - INTERVAL '7 days' AND NOW() + '${days} days'::INTERVAL
        ORDER BY employee_name, module_id, created_at DESC
      `);
    } else {
      rows = await query(`
        SELECT id, employee_name, module_id, module_title, language, created_at,
               date(created_at,'+1 year') AS expiry_date,
               CAST(julianday(date(created_at,'+1 year')) - julianday('now') AS INTEGER) AS days_left
        FROM completions
        WHERE date(created_at,'+1 year') BETWEEN date('now','-7 days') AND date('now','+${days} days')
        ORDER BY expiry_date ASC
      `);
    }
    res.json(rows.map(r => ({ ...r, days_left: Number(r.days_left) })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: employees list ─────────────────────────────────────────────────────
app.get('/api/admin/employees', adminAuth, async (req, res) => {
  try {
    const emps = await query('SELECT id,name,email,created_at FROM employees ORDER BY name');
    const counts = await query('SELECT employee_id, COUNT(*) AS c FROM completions WHERE employee_id IS NOT NULL GROUP BY employee_id');
    const countMap = Object.fromEntries(counts.map(r => [r.employee_id, Number(r.c)]));
    res.json(emps.map(e => ({ ...e, completion_count: countMap[e.id] || 0 })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: send expiry email reminders ───────────────────────────────────────
app.post('/api/admin/send-reminders', adminAuth, async (req, res) => {
  if (!mailer) {
    return res.status(503).json({
      error: 'Email not configured.',
      setup: 'In Railway → Variables, add EMAIL_USER (your Gmail address) and EMAIL_PASS (Gmail App Password). See: myaccount.google.com/apppasswords'
    });
  }
  try {
    const isPg = !!process.env.DATABASE_URL;
    let rows;
    if (isPg) {
      rows = await query(`
        SELECT DISTINCT ON (e.email, c.module_id)
               e.name, e.email, c.module_title,
               (c.created_at + INTERVAL '1 year')::DATE AS expiry_date,
               CEIL(EXTRACT(EPOCH FROM ((c.created_at + INTERVAL '1 year') - NOW())) / 86400)::INT AS days_left
        FROM completions c JOIN employees e ON c.employee_id = e.id
        WHERE (c.created_at + INTERVAL '1 year') BETWEEN NOW() AND NOW() + INTERVAL '30 days'
        ORDER BY e.email, c.module_id, c.created_at DESC
      `);
    } else {
      rows = await query(`
        SELECT e.name, e.email, c.module_title,
               date(c.created_at,'+1 year') AS expiry_date,
               CAST(julianday(date(c.created_at,'+1 year')) - julianday('now') AS INTEGER) AS days_left
        FROM completions c JOIN employees e ON c.employee_id = e.id
        WHERE date(c.created_at,'+1 year') BETWEEN date('now') AND date('now','+30 days')
        ORDER BY e.email, expiry_date ASC
      `);
    }
    // Group by employee email
    const byEmail = {};
    for (const r of rows) {
      if (!byEmail[r.email]) byEmail[r.email] = { name: r.name, modules: [] };
      byEmail[r.email].modules.push({ title: r.module_title, expiry: r.expiry_date, days: Number(r.days_left) });
    }
    let sent = 0;
    for (const [email, data] of Object.entries(byEmail)) {
      const moduleList = data.modules
        .map(m => `  • ${m.title} — expires ${m.expiry} (${m.days} days)`)
        .join('\n');
      await mailer.sendMail({
        from: `"CRR Safety Training" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Action Required: Safety Training Expiring Soon',
        text: `Hi ${data.name},\n\nThe following safety trainings are expiring within 30 days and need to be renewed:\n\n${moduleList}\n\nPlease log in to the CRR Safety Training Portal to complete your renewals.\n\nCommercial Roofing Rana LLC — Safety Department`
      });
      sent++;
    }
    res.json({ success: true, sent, total: rows.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: certificate ────────────────────────────────────────────────────────
app.get('/api/admin/certificate/:id', adminAuth, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM completions WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).send('Not found');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildCertPage(rows[0]));
  } catch(e) { res.status(500).send(e.message); }
});

// ── Admin: delete ─────────────────────────────────────────────────────────────
app.delete('/api/admin/completions/:id', adminAuth, async (req, res) => {
  try {
    await query('DELETE FROM completions WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: delete employee ────────────────────────────────────────────────────
app.delete('/api/admin/employees/:id', adminAuth, async (req, res) => {
  try {
    await query('DELETE FROM employees WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: CSV export ─────────────────────────────────────────────────────────
app.get('/api/admin/export', adminAuth, async (req, res) => {
  try {
    const rows = await query('SELECT id,employee_name,module_title,language,date_completed,quiz_score,created_at FROM completions ORDER BY created_at DESC');
    const esc  = v => `"${String(v||'').replace(/"/g,'""')}"`;
    const csv  = [
      'ID,Employee Name,Module Title,Language,Date Completed,Quiz Score,Recorded At',
      ...rows.map(r => [r.id,esc(r.employee_name),esc(r.module_title),r.language,esc(r.date_completed),esc(r.quiz_score),esc(r.created_at)].join(','))
    ].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="CRR_Training_Records.csv"');
    res.send(csv);
  } catch(e) { res.status(500).send(e.message); }
});

// ── Certificate page builder ──────────────────────────────────────────────────
function buildCertPage(row) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Certificate – ${row.employee_name} – ${row.module_title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#1a1208;color:#e8e8e8;min-height:100vh}
.toolbar{background:#111;padding:14px 24px;display:flex;align-items:center;gap:16px;border-bottom:1px solid #2a2a2a}
.toolbar h2{color:#c9a227;font-size:1em;flex:1}
.toolbar button{background:linear-gradient(135deg,#c9a227,#f5c842);color:#111;border:none;padding:10px 22px;border-radius:8px;font-size:0.9em;font-weight:700;cursor:pointer}
.cert-wrap{display:flex;align-items:center;justify-content:center;padding:40px;min-height:calc(100vh - 57px)}
#certificate,#cert{position:relative;background:linear-gradient(160deg,#0e0e0e 0%,#181208 50%,#0e0e0e 100%);border:3px double #c9a227;border-radius:14px;padding:36px 40px;max-width:800px;width:100%;overflow:hidden}
#certificate::before,#cert::before{content:'';position:absolute;top:8px;left:8px;right:8px;bottom:8px;border:1px solid rgba(201,162,39,0.25);border-radius:10px;pointer-events:none}
.cert-logo-row,.clr{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.cert-logo,.cl{width:64px;height:64px;object-fit:contain}
.cert-co,.cc{font-size:0.85em;font-weight:700;color:#c9a227;letter-spacing:2px;text-transform:uppercase;text-align:center}
.cert-title-block,.ctb{margin:10px 0 22px;text-align:center}
.cert-presents,.cp{font-size:0.8em;letter-spacing:3px;color:#888;text-transform:uppercase}
.cert-award,.ca{font-size:2rem;font-weight:900;background:linear-gradient(135deg,#f5c842,#c9a227);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:6px 0 10px}
.cert-module,.cm{font-size:1rem;color:#b0a080;letter-spacing:1px}
.cert-divider{border:none;border-top:1px solid rgba(201,162,39,0.3);margin:18px 0}
.cert-name-label,.cnl{font-size:0.75em;color:#888;letter-spacing:2px;text-transform:uppercase;text-align:center}
.cert-name,.cn{font-size:1.85rem;font-weight:700;color:#f0e0a0;font-style:italic;margin:4px 0 18px;text-align:center}
.cert-meta-row,.cmr{display:flex;justify-content:center;gap:30px;flex-wrap:wrap;margin:14px 0}
.cert-meta,.cmt{text-align:center}
.cert-meta-label,.cmtl{font-size:0.7em;color:#777;letter-spacing:1px;text-transform:uppercase}
.cert-meta-val,.cmtv{font-size:0.9em;color:#c0b070;font-weight:600}
.cert-badges,.cbg{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:18px 0}
.cert-badge,.cbg2{background:rgba(201,162,39,0.12);border:1px solid rgba(201,162,39,0.4);color:#c9a227;border-radius:20px;padding:5px 13px;font-size:0.72em;font-weight:600}
@media print{.toolbar{display:none}body{background:#fff}.cert-wrap{padding:20px;min-height:auto}#certificate,#cert{border-color:#c9a227!important}}
</style></head><body>
<div class="toolbar">
  <h2>Certificate — ${row.employee_name} — ${row.module_title}</h2>
  <button onclick="window.print()">🖨️ Print / Save as PDF</button>
  <button onclick="window.close()" style="background:#333;color:#ccc">✕ Close</button>
</div>
<div class="cert-wrap">${row.certificate_html || '<p style="color:#888;text-align:center">Certificate unavailable.</p>'}</div>
</body></html>`;
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  const ifaces = require('os').networkInterfaces();
  let localIP = 'localhost';
  for (const iface of Object.values(ifaces).flat()) {
    if (iface.family === 'IPv4' && !iface.internal) { localIP = iface.address; break; }
  }
  console.log(`\n[CRR] Portal running — http://localhost:${PORT}  |  Network: http://${localIP}:${PORT}\n`);
});
