// @polsia:user-owned — in-memory email proxy sink for authenticated browser tests.
import { createServer } from 'node:http';
import type { FullConfig } from '@playwright/test';

type CapturedEmail = { to: string; subject: string; body: string; html?: string };

function parseEmail(value: unknown): CapturedEmail | null {
  if (typeof value !== 'object' || value === null) return null;
  if (
    !('to' in value) ||
    typeof value.to !== 'string' ||
    !('subject' in value) ||
    typeof value.subject !== 'string' ||
    !('body' in value) ||
    typeof value.body !== 'string' ||
    ('html' in value && typeof value.html !== 'string')
  ) {
    return null;
  }
  const email: CapturedEmail = {
    to: value.to,
    subject: value.subject,
    body: value.body,
  };
  if ('html' in value) {
    if (typeof value.html !== 'string') return null;
    email.html = value.html;
  }
  return email;
}

export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  const capturedEmails: CapturedEmail[] = [];
  const server = createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/send') {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk: string) => {
        body += chunk;
      });
      request.on('end', () => {
        try {
          const email = parseEmail(JSON.parse(body) as unknown);
          if (!email) {
            response.writeHead(400);
            response.end();
            return;
          }
          capturedEmails.push(email);
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ success: true, email_id: `test-${capturedEmails.length}` }));
        } catch {
          response.writeHead(400);
          response.end();
        }
      });
      return;
    }

    if (request.method === 'GET' && request.url === '/messages') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(capturedEmails));
      return;
    }

    if (request.method === 'DELETE' && request.url === '/messages') {
      capturedEmails.length = 0;
      response.writeHead(204);
      response.end();
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(3199, '127.0.0.1', resolve);
  });

  return () => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
