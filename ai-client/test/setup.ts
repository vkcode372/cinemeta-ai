import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
