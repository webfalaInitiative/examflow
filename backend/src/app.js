import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

import apiRoutes from './routes/index.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api', apiRoutes);

app.get('/', (req, res) => res.json({ service: 'exam-flow-backend', status: 'ok' }));

// 404
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

export default app;
