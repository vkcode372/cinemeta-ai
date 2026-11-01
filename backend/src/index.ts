import 'dotenv/config';
import { app } from './app.js';
import { sequelize } from './config/database.js';

const port = Number(process.env.PORT ?? 4000);
void sequelize.authenticate().then(() => {
  app.listen(port, () => console.info(`CineMate API listening on port ${port}`));
}).catch((error: unknown) => {
  console.error('Unable to connect to PostgreSQL', error);
  process.exitCode = 1;
});
