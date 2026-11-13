const express = require('express');
const cors = require('cors');
const multer = require('multer');

const config = require('./config/env');
const { supabase } = require('./db/supabase');
const { hashPassword, comparePassword } = require('./lib/passwords');
const { signToken } = require('./lib/jwt');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');
const { extractText } = require('./lib/extractText');
const { analyzeDocument } = require('./lib/analyzers');
const { LoadBalancer } = require('./lib/loadBalancer');

const app = express();

// ---------------- Balanceador de cargas ----------------
// Pool de workers que ejecuta los análisis CPU-bound con least-busy.
const analyzerBalancer = new LoadBalancer({
  workers: config.analyzer.workers,
  queueLimit: config.analyzer.queueLimit,
  taskTimeoutMs: config.analyzer.taskTimeoutMs,
  name: 'doc-analyzer'
});

// ---------------- Middlewares ----------------
// Orígenes permitidos: los de CORS_ORIGIN + cualquier localhost/127.0.0.1
// (cubre puertos dinámicos de previews y desarrollo local)
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || config.corsOrigins.includes(origin) || LOCALHOST_RE.test(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15 MB
});

// ---------------- Health ----------------
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'sistemaia-api' }));

app.get('/metrics', requireAdmin, (req, res) => {
  res.json(analyzerBalancer.stats);
});

// ---------------- Auth ----------------
app.post('/auth/register', async (req, res, next) => {
  try {
    const { email, password, fullName, role } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (role && role !== 'student' && role !== 'admin') {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const passwordHash = await hashPassword(password);
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        full_name: fullName || null,
        // El primer usuario registrado puede ser admin; el resto, student.
        role: 'student'
      })
      .select('id, email, full_name, role, created_at')
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'El email ya está registrado' });
      throw error;
    }

    // Si es el primer usuario del sistema, promover a admin
    const { count } = await supabase.from('users').select('id', { count: 'exact', head: true });
    if (count === 1) {
      await supabase.from('users').update({ role: 'admin' }).eq('id', data.id);
      data.role = 'admin';
    }

    const token = signToken(data);
    res.status(201).json({ token, user: data });
  } catch (err) { next(err); }
});

app.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son obligatorios' });

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, password_hash')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) throw error;
    if (!user || !(await comparePassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = signToken(user);
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) { next(err); }
});

app.get('/auth/me', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, created_at')
      .eq('id', req.user.sub)
      .single();
    if (error) throw error;
    res.json({ user: data });
  } catch (err) { next(err); }
});

// ---------------- Documents ----------------
app.post('/documents', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Adjunte un archivo (campo "file")' });

    const text = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (!text || text.trim().length < 50) {
      return res.status(422).json({ error: 'No se pudo extraer suficiente texto del documento' });
    }

    const title = (req.body.title || req.file.originalname.replace(/\.[^.]+$/, '')).slice(0, 200);

    const { data: doc, error } = await supabase
      .from('documents')
      .insert({
        owner_id: req.user.sub,
        title,
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size_bytes: req.file.size,
        raw_text: text,
        status: 'uploaded'
      })
      .select('id, title, original_name, status, created_at')
      .single();
    if (error) throw error;

    res.status(201).json({ document: doc });
  } catch (err) { next(err); }
});

app.post('/documents/:id/analyze', requireAuth, async (req, res, next) => {
  try {
    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, owner_id, raw_text, status')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    if (doc.owner_id !== req.user.sub && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tiene permiso sobre este documento' });
    }
    if (!doc.raw_text) return res.status(422).json({ error: 'El documento no tiene texto extraíble' });

    await supabase.from('documents').update({ status: 'analyzing' }).eq('id', doc.id);

    // Balanceador de cargas: la tarea pesada se asigna al worker menos ocupado
    const analysis = await analyzerBalancer.run(() => analyzeDocument(doc.raw_text));

    const { error: upErr } = await supabase
      .from('analyses')
      .insert({
        document_id: doc.id,
        ai_probability: analysis.aiProbability,
        orthography: analysis.orthography,
        style: analysis.style,
        presentation: analysis.presentation,
        meta: analysis.meta
      });
    if (upErr) throw upErr;

    await supabase.from('documents').update({ status: 'analyzed' }).eq('id', doc.id);

    res.json({ analysis });
  } catch (err) {
    await supabase.from('documents').update({ status: 'error' }).eq('id', req.params.id).then(() => {});
    next(err);
  }
});

app.get('/documents', requireAuth, async (req, res, next) => {
  try {
    let query = supabase
      .from('documents')
      .select('id, title, original_name, mime_type, size_bytes, status, created_at')
      .order('created_at', { ascending: false });

    if (req.user.role !== 'admin') query = query.eq('owner_id', req.user.sub);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ documents: data });
  } catch (err) { next(err); }
});

app.get('/documents/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, title, original_name, mime_type, size_bytes, status, created_at, owner_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    if (doc.owner_id !== req.user.sub && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tiene permiso' });
    }
    delete doc.owner_id;

    const { data: analysis } = await supabase
      .from('analyses')
      .select('*')
      .eq('document_id', doc.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    res.json({ document: doc, analysis });
  } catch (err) { next(err); }
});

app.delete('/documents/:id', requireAuth, async (req, res, next) => {
  try {
    const { data: doc } = await supabase
      .from('documents').select('owner_id').eq('id', req.params.id).maybeSingle();
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    if (doc.owner_id !== req.user.sub && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tiene permiso' });
    }
    const { error } = await supabase.from('documents').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------------- 404 / errores ----------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
module.exports.analyzerBalancer = analyzerBalancer;
