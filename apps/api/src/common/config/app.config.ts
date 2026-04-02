export const appConfig = () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'change-me',
  },
});
