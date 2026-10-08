import dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

// `neon link` guarda las conexiones en .env.local; cargar también .env como fallback.
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const migrationUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  'postgresql://user:password@localhost:5432/sigesmed?schema=public'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: migrationUrl,
  },
})
