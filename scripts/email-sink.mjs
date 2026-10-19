/**
 * Local Polsia email-proxy sink for development.
 * Captures verification emails at http://127.0.0.1:3199
 * GET /messages — list captured emails
 * DELETE /messages — clear
 */
import { createServer } from 'node:http';

const captured = [];

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/send') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const email = JSON.parse(body);
        captured.push({ ...email, capturedAt: new Date().toISOString() });
        console.log(`[email-sink] to=${email.to} subject=${email.subject}`);
        if (email.html?.includes('http')) {
          const match = email.html.match(/https?:\/\/[^"'>\s]+/);
          if (match) console.log(`[email-sink] link=${match[0]}`);
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: true, email_id: `local-${captured.length}` }));
      } catch {
        res.writeHead(400);
        res.end();
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/messages') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(captured, null, 2));
    return;
  }

  if (req.method === 'DELETE' && req.url === '/messages') {
    captured.length = 0;
    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(3199, '127.0.0.1', () => {
  console.log('Email sink listening on http://127.0.0.1:3199');
});
