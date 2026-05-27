// Built-in node:test runner. No extra deps.

const test = require('node:test');
const assert = require('node:assert');
const app = require('./server');

async function withRunningServer(fn) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    await fn(server.address().port);
  } finally {
    server.close();
  }
}

test('GET /health returns ok', async () => {
  await withRunningServer(async (port) => {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
    assert.ok(typeof body.uptime === 'number');
  });
});

test('GET / returns service identity', async () => {
  await withRunningServer(async (port) => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.service, 'payments-api');
  });
});
