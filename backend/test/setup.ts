import 'dotenv/config';

if (process.env.NODE_ENV !== 'test' || (!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL)) {
  throw new Error('Set NODE_ENV=test and DATABASE_URL, or use TEST_DATABASE_URL for a separate PostgreSQL database');
}
