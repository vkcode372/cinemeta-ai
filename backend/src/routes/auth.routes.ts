import { Router } from 'express';
import { login, logout, me, register } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema, registerSchema } from '../validators/auth.validators.js';

export const authRoutes = Router();
authRoutes.post('/register', validate(registerSchema), register);
authRoutes.post('/login', validate(loginSchema), login);
authRoutes.post('/logout', logout);
authRoutes.get('/me', authenticate, me);
