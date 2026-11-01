import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });
process.env.BACKEND_BASE_URL ??= 'http://127.0.0.1:4400';
