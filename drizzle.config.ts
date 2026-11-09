import { defineConfig } from 'drizzle-kit';

// Generation only. Migrations are applied by the app runner (5.5), never by drizzle-kit.
// Every generated migration must be reviewed against src/db/README.md before it is committed.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
});
