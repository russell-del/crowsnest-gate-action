const core = require('@actions/core');

const ICONS = { pass: '✓', go: '✓', fail: '✗', 'no-go': '✗', stale: '⏱', warn: '⚠', skipped: '·' };

function icon(decision) {
  return ICONS[decision] || '?';
}

function deriveConsoleUrl(apiUrl) {
  // api-server typically lives on :8000; console on :3000.
  // If api-url contains :8000 or :18000, swap to the console port.
  try {
    const u = new URL(apiUrl);
    if (u.port === '8000') u.port = '3000';
    else if (u.port === '18000') u.port = '13000';
    return u.origin;
  } catch {
    return apiUrl;
  }
}

function formatStageBlock(stage) {
  const lines = [];
  const d = stage.decision || '?';
  const score = stage.score !== undefined ? `  (score ${stage.score})` : '';
  const reasons = Array.isArray(stage.failureReasons) && stage.failureReasons.length
    ? `  reasons: ${stage.failureReasons.join(',')}`
    : '';
  lines.push(`  ${icon(d)} ${stage.name || stage.gateName}  ${d.toUpperCase()}${score}${reasons}`);
  for (const c of stage.checks || []) {
    const cd = c.decision || '?';
    const tag = c.kind === 'required' ? 'req' : (c.kind === 'scored' ? 'sco' : c.kind || '?');
    const w = c.weight !== undefined ? `w=${c.weight}` : '';
    const msg = (c.message || '').slice(0, 140);
    lines.push(`      ${icon(cd)} [${tag} ${w}] ${c.name}  ·  ${msg}`);
  }
  return lines.join('\n');
}

function buildSummary({ decision, runId, runUrl, durationMs, stages }) {
  const lines = [];
  lines.push(`### CrowsNest Release Gate — \`${decision.toUpperCase()}\``);
  lines.push('');
  lines.push(`- **Run id:** \`${runId}\``);
  lines.push(`- **Duration:** ${durationMs} ms`);
  if (runUrl) lines.push(`- **Run detail:** [${runUrl}](${runUrl})`);
  lines.push('');
  lines.push('| Stage | Decision | Score | Reasons |');
  lines.push('|---|---|---|---|');
  for (const s of stages || []) {
    const d = s.decision || '?';
    const reasons = (s.failureReasons || []).join(', ');
    lines.push(`| ${s.name || s.gateName} | ${icon(d)} ${d.toUpperCase()} | ${s.score ?? '—'} | ${reasons || '—'} |`);
  }
  // Per-check breakdown
  for (const s of stages || []) {
    if (!s.checks || s.checks.length === 0) continue;
    lines.push('');
    lines.push(`#### ${s.name || s.gateName} — checks`);
    lines.push('| Check | Decision | Kind | Weight | Message |');
    lines.push('|---|---|---|---|---|');
    for (const c of s.checks) {
      const m = (c.message || '').replace(/\|/g, '\\|');
      lines.push(`| ${c.name} | ${icon(c.decision)} ${c.decision} | ${c.kind || ''} | ${c.weight ?? ''} | ${m} |`);
    }
  }
  return lines.join('\n');
}

async function run() {
  try {
    const apiUrl = core.getInput('api-url', { required: true }).replace(/\/+$/, '');
    const appId = core.getInput('app-id', { required: true });
    const pipelineName = core.getInput('pipeline-name', { required: true });
    const stageName = core.getInput('stage-name') || '';
    const attachRunId = core.getInput('run-id') || '';
    const token = core.getInput('token', { required: true });
    const consoleBaseInput = core.getInput('console-base-url');
    const warnAsFailure = core.getInput('warn-as-failure').toLowerCase() === 'true';
    const timeoutSeconds = parseInt(core.getInput('timeout-seconds') || '60', 10);

    core.setSecret(token);

    const base = `${apiUrl}/api/pipeline/run/${encodeURIComponent(appId)}/${encodeURIComponent(pipelineName)}`;
    const url = stageName ? `${base}?stage=${encodeURIComponent(stageName)}` : base;
    core.info(`POST ${url}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'crowsnest-gate-action',
        },
        body: JSON.stringify(attachRunId ? { runId: attachRunId } : {}),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const bodyText = await res.text();

    // The api-server returns a structured gate response (with a `decision`
    // field) even on non-2xx status codes — e.g. HTTP 422 with a `no-go`
    // decision is a "successful evaluation that blocked." We treat the body
    // as authoritative whenever it parses into a gate response.
    let body = null;
    try {
      body = JSON.parse(bodyText);
    } catch {
      // not JSON
    }

    const looksLikeGateResponse = body && typeof body === 'object' && 'decision' in body;
    if (!looksLikeGateResponse) {
      core.error(`api-server returned ${res.status}: ${bodyText.slice(0, 500)}`);
      core.setFailed(`Gate request failed: HTTP ${res.status}`);
      return;
    }

    const decision = (body.decision || 'no-go').toLowerCase();
    const runId = body.runId || '';
    const durationMs = body.durationMs ?? 0;
    const stages = Array.isArray(body.stages) ? body.stages : [];

    const consoleBase = consoleBaseInput || deriveConsoleUrl(apiUrl);
    const runUrl = runId ? `${consoleBase}/pipelines/runs/${runId}` : '';

    core.setOutput('decision', decision);
    core.setOutput('run-id', runId);
    core.setOutput('run-url', runUrl);
    core.setOutput('duration-ms', String(durationMs));

    core.startGroup(`CrowsNest pipeline ${pipelineName} → ${decision.toUpperCase()} (${durationMs}ms)`);
    for (const s of stages) core.info(formatStageBlock(s));
    if (runUrl) core.info(`Run detail: ${runUrl}`);
    core.endGroup();

    if (process.env.GITHUB_STEP_SUMMARY) {
      const fs = require('node:fs');
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, buildSummary({ decision, runId, runUrl, durationMs, stages }) + '\n');
    }

    if (decision === 'go') {
      core.info(`Gate decision: GO`);
      return;
    }
    if (decision === 'warn') {
      const msg = `Gate decision: WARN — proceeding (set warn-as-failure: 'true' to block on warn). ${runUrl}`;
      if (warnAsFailure) core.setFailed(msg);
      else core.warning(msg);
      return;
    }
    // no-go (or anything else)
    core.setFailed(`Gate decision: ${decision.toUpperCase()} — see ${runUrl || 'run detail'} for evidence.`);
  } catch (err) {
    if (err.name === 'AbortError') {
      core.setFailed(`Gate request timed out`);
    } else {
      core.setFailed(`Unexpected error: ${err.message}`);
    }
  }
}

run();
