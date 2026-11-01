import express from 'express';
import { errorHandler } from './middlewares/error-handler.js';
import { authRoutes } from './routes/auth.routes.js';
import { movieRoutes } from './routes/movie.routes.js';
import { bookingRoutes } from './routes/booking.routes.js';
import { paymentRoutes } from './routes/payment.routes.js';

export const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use((_req, res) => res.status(404).json({ error: { message: 'Route not found' } }));
app.use(errorHandler);
