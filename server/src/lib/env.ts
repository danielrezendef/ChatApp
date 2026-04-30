const requiredVars = ['DATABASE_URL', 'JWT_SECRET'] as const;

export function validateEnv() {
  const missing = requiredVars.filter(name => !process.env[name]);

  if (missing.length > 0) {
    console.error(`[env] Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.MESSAGE_SECRET) {
    console.warn('[env] MESSAGE_SECRET não configurado. Usando JWT_SECRET como fallback para criptografia.');
  }
}
