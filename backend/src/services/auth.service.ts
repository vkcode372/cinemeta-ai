import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { AppError } from '../errors/app-error.js';
import { getJwtSecret } from '../config/jwt.js';

export async function register(input: { name: string; email: string; password: string }) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await User.create({ name: input.name, email: input.email.toLowerCase(), passwordHash });
  return { id: user.get('id'), name: user.get('name'), email: user.get('email') };
}

export async function login(input: { email: string; password: string }) {
  const user = await User.findOne({ where: { email: input.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(input.password, String(user.get('passwordHash'))))) {
    throw new AppError('Invalid email or password', 401);
  }
  const secret = getJwtSecret();
  const token = jwt.sign({}, secret, {
    algorithm: 'HS256',
    subject: String(user.get('id')),
    expiresIn: '15m',
    issuer: 'cinemate-api',
    audience: 'cinemate-client',
  });
  return { token, user: { id: user.get('id'), name: user.get('name'), email: user.get('email') } };
}

export async function getPublicUser(id: string) {
  const user = await User.findByPk(id, { attributes: ['id', 'name', 'email'] });
  if (!user) throw new AppError('User account not found', 404);
  return { id: user.get('id'), name: user.get('name'), email: user.get('email') };
}
