export const appConfig = () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3004),
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'change-me',
  },
  ai: {
    provider: process.env.AI_PROVIDER ?? 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    openaiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    openaiTimeoutSeconds: Number(process.env.OPENAI_TIMEOUT_SECONDS ?? 45),
  },
  catalog: {
    provider: process.env.CATALOG_PROVIDER ?? 'local',
  },
  flor: {
    apiBaseUrl: process.env.FLOR_API_BASE_URL ?? 'http://localhost:8000',
  },
  review: {
    delayMinutes: Number(process.env.REVIEW_DELAY_MINUTES ?? 7),
  },
});
