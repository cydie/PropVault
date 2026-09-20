import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initSchema, testConnection } from './db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import propertyRoutes from './routes/properties.js';
import certRoutes from './routes/certifications.js';
import notifRoutes from './routes/notifications.js';
import auditRoutes from './routes/audit.js';
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';
import paymentRoutes from './routes/payments.js';
import syncRoutes from './routes/sync.js';
import cadastralRoutes from './routes/cadastral.js';
import cadastralPlansRoutes from './routes/cadastralPlans.js';
import cadastralFaasRoutes from './routes/cadastralFaas.js';
import cadastralIndexRoutes from './routes/cadastralIndex.js';
import cadastralAssessorRoutes from './routes/cadastralAssessor.js';
import { freePort } from '../scripts/free-port.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const isDev = process.env.NODE_ENV !== 'production';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', async (_req, res) => {
  try {
    const db = await testConnection();
    res.json({
      status: 'ok',
      app: 'PropVault API',
      version: '1.0.0',
      database: 'PostgreSQL',
      dbName: db?.db,
      dbTime: db?.now,
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      app: 'PropVault API',
      database: 'PostgreSQL',
      error: err.message,
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/certifications', certRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/cadastral', cadastralRoutes);
app.use('/api/cadastral', cadastralPlansRoutes);
app.use('/api/cadastral', cadastralFaasRoutes);
app.use('/api/cadastral', cadastralIndexRoutes);
app.use('/api/cadastral', cadastralAssessorRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await initSchema();
    const db = await testConnection();
    console.log(`PostgreSQL connected: ${db.db}`);
    const HOST = process.env.HOST || '0.0.0.0';
    if (isDev) freePort(PORT);
    const server = app.listen(PORT, HOST, () => {
      console.log(`PropVault API running at http://localhost:${PORT}`);
      console.log(`Intranet: other devices can use http://<server-lan-ip>:${PORT}`);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use.`);
        console.error('Close other PropVault API terminals, or save a file to retry (dev auto-frees the port).');
        process.exit(1);
      }
      console.error(err);
      process.exit(1);
    });
  } catch (err) {
    console.error('Failed to start API — PostgreSQL not available.');
    console.error(err.message);
    console.error('\nSetup steps:');
    console.error('  1. Install PostgreSQL locally');
    console.error('  2. cd server && npm run db:setup');
    console.error('  3. Copy .env.example to .env');
    console.error('  4. npm run seed && npm start');
    process.exit(1);
  }
}

start();
