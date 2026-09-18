let appPromise;

async function app() {
  if (!appPromise) {
    appPromise = (async () => {
      const { createApp } = await import('../server/dist/app.js');
      const { loadConfig } = await import('../server/dist/config.js');
      const config = loadConfig(process.env);
      return createApp({ config });
    })();
  }
  return appPromise;
}

export default async function handler(request, response) {
  try {
    const fastify = await app();
    await fastify.ready();
    fastify.server.emit('request', request, response);
  } catch {
    if (!response.headersSent) response.statusCode = 503;
    response.end(JSON.stringify({ error: { code: 'CHAIN_UNAVAILABLE', message: 'Lighthouse service could not start', retryable: true } }));
  }
}
