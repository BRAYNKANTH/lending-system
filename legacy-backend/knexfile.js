import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const dbClient = process.env.DB_CLIENT || 'sqlite3';

const config = {
  client: dbClient,
  connection: dbClient === 'pg' 
    ? process.env.DATABASE_URL 
    : { filename: path.join(__dirname, 'lend.db') },
  useNullAsDefault: dbClient === 'sqlite3',
  migrations: {
    directory: path.join(__dirname, 'src', 'db', 'migrations'),
  },
  seeds: {
    directory: path.join(__dirname, 'src', 'db', 'seeds'),
  },
  pool: dbClient === 'pg' ? {
    min: 2,
    max: 10
  } : undefined
};

export default config;
