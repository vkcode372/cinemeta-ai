import 'dotenv/config';
import { Sequelize } from 'sequelize';

const databaseUrl = process.env.NODE_ENV === 'test'
  ? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
  : process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL (or TEST_DATABASE_URL when testing) must be set');

export const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  define: { underscored: true, timestamps: true },
});
