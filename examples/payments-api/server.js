// payments-api — a minimal reference service used by the release-pipeline
// demo. Two endpoints, structured logging, a single dependency tree.
// Real enough that:
//   - the build produces a real container image
//   - the test step actually exercises HTTP
//   - the Trivy scan finds real CVEs in the base layer + node_modules
//   - the SBOM has real components

const express = require('express');
const logger = require('pino')();

const app = express();
const port = process.env.PORT || 3000;
const version = process.env.APP_VERSION || '1.0.0';

app.get('/', (req, res) => {
  res.json({ service: 'payments-api', version });
});

app.get('/health', (req, res) => {
  logger.info({ path: '/health' }, 'health check');
  res.json({ status: 'ok', version, uptime: process.uptime() });
});

module.exports = app;

if (require.main === module) {
  app.listen(port, () => {
    logger.info(`payments-api v${version} listening on :${port}`);
  });
}
