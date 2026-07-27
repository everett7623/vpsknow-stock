import { createServer, type Server } from 'node:http';

export interface HealthDependencyStatus {
  database: 'healthy' | 'unhealthy';
  redis: 'healthy' | 'unhealthy';
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  dependencies: HealthDependencyStatus;
}

interface HealthServerOptions {
  port: number;
  check: () => Promise<HealthCheckResult>;
}

export async function startHealthServer(options: HealthServerOptions): Promise<Server> {
  const server = createServer(async (request, response) => {
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    try {
      const result = await options.check();
      response.writeHead(result.status === 'healthy' ? 200 : 503, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      response.end(JSON.stringify(result));
    } catch {
      response.writeHead(503, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      response.end(JSON.stringify({
        status: 'unhealthy',
        dependencies: {
          database: 'unhealthy',
          redis: 'unhealthy',
        },
      } satisfies HealthCheckResult));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, '0.0.0.0', resolve);
  });

  return server;
}
