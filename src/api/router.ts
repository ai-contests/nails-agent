export type RouteHandler = (
  req: Request,
  params: Record<string, string>
) => Promise<Response> | Response;

interface RegisteredRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS';
  pathPattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: RegisteredRoute[] = [];

  public get(path: string, handler: RouteHandler) {
    this.addRoute('GET', path, handler);
  }

  public post(path: string, handler: RouteHandler) {
    this.addRoute('POST', path, handler);
  }

  public put(path: string, handler: RouteHandler) {
    this.addRoute('PUT', path, handler);
  }

  public delete(path: string, handler: RouteHandler) {
    this.addRoute('DELETE', path, handler);
  }

  private addRoute(method: RegisteredRoute['method'], path: string, handler: RouteHandler) {
    const paramNames: string[] = [];
    const regexPath = path
      .replace(/:([^/]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      })
      .replace(/\//g, '\\/');

    const pathPattern = new RegExp(`^${regexPath}$`);
    this.routes.push({ method, pathPattern, paramNames, handler });
  }

  public async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method as RegisteredRoute['method'];

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: this.corsHeaders(),
      });
    }

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = url.pathname.match(route.pathPattern);
      if (match) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((name, idx) => {
          params[name] = match[idx + 1] || '';
        });

        try {
          const response = await route.handler(req, params);
          // Inject CORS headers
          const responseHeaders = new Headers(response.headers);
          const cors = this.corsHeaders();
          for (const key of Object.keys(cors)) {
            responseHeaders.set(key, cors[key] || '');
          }
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
          });
        } catch (error: unknown) {
          const err = error as Error;
          console.error(`Error handling ${method} ${url.pathname}:`, err);
          return new Response(
            JSON.stringify({ error: err.message || String(error) }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                ...this.corsHeaders(),
              },
            }
          );
        }
      }
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...this.corsHeaders(),
      },
    });
  }

  private corsHeaders(): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Id',
    };
  }
}

