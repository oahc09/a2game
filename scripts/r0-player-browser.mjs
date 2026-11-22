/** Real browser smoke for two already built, trusted R0 standalone deliveries. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { chromium, webkit } from 'playwright';

const args = process.argv.slice(2);
if (args.length !== 3) throw Error('Usage: node scripts/r0-player-browser.mjs <trusted Sokoban package> <trusted Shooter package> <new report dir>');
const [sokoban, shooter, out] = args.map((arg) => resolve(arg));
const engine = process.env.A2GAME_SMOKE_BROWSER || 'chromium';
if (!['chromium', 'webkit'].includes(engine)) throw Error('Unsupported smoke browser');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const mime = new Map([['.html', 'text/html'], ['.mjs', 'text/javascript'], ['.js', 'text/javascript'], ['.json', 'application/json'], ['.wasm', 'application/wasm']]);
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const entry = files.get(pathname);
  if (!entry || request.method !== 'GET') return response.writeHead(404).end();
  response.writeHead(200, {'Content-Type': entry.type, 'Cache-Control': 'no-store'}).end(entry.bytes);
});
const files = new Map();
const selected = [['sokoban', sokoban], ['shooter', shooter]];
const report = {
  status: 'FAIL', scope: 'R0_PACKAGED_SOFTWARE_BROWSER_SMOKE', engine,
  visibility: 'synthetic document.hidden visibilitychange; no OS lifecycle claim',
  cases: [], builds: {},
};
await mkdir(out);
for (const [id, dir] of selected) {
  const inventoryBytes = await readFile(resolve(dir, 'build-inventory.json'));
  const inventory = JSON.parse(inventoryBytes);
  for (const item of inventory.files) {
    const path = resolve(dir, item.file);
    const key = relative(dir, path).split('\\').join('/');
    assert(!isAbsolute(key) && !key.startsWith('..') && key === item.file);
    const bytes = await readFile(path);
    assert.equal(hash(bytes), item.sha256, item.file);
    const ext = basename(key).match(/\.[^.]+$/)?.[0];
    files.set('/' + id + '/' + key, {bytes, type: mime.get(ext) ?? 'application/octet-stream'});
  }
  assert(files.has('/' + id + '/licenses/a2game-LICENSE'));
  report.builds[id] = {inventoryHash: hash(inventoryBytes), files: inventory.files.length, game: inventory.receipt.id};
}
let browser;
try {
  await new Promise((ok, fail) => server.listen(0, '127.0.0.1', ok).once('error', fail));
  const base = 'http://127.0.0.1:' + server.address().port;
  const executablePath = process.env.A2GAME_BROWSER_EXECUTABLE;
  browser = await (engine === 'webkit' ? webkit : chromium).launch({headless: true, timeout: 20000, ...(executablePath ? {executablePath} : {})});
  report.version = browser.version();
  for (const [id] of selected) for (const backend of ['three', 'cocosairjs']) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}});
    const page = await context.newPage();
    page.setDefaultTimeout(16000);
    const row = {id, backend, actions: [], errors: [], status: 'FAIL'};
    report.cases.push(row);
    page.on('pageerror', (error) => row.errors.push(error.message));
    page.on('response', (response) => { if (response.status() >= 400) row.errors.push(response.status() + ' ' + new URL(response.url()).pathname); });
    await page.route('**/*', (route) => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
    const waitStatus = (status) => page.waitForFunction((state) => window.examplePlayer?.status() === state, status);
    const shot = (phase) => page.screenshot({path: resolve(out, id + '-' + backend + '-' + phase + '.png')});
    const held = () => page.evaluate(() => window.examplePlayer.diagnostics().heldSources);
    try {
      await page.goto(base + '/' + id + '/player/index.html?backend=' + backend);
      await page.locator('#start:enabled').waitFor();
      assert.equal(await page.locator('#game canvas').count(), 1);
      await shot('ready');
      await page.locator('#start').click();
      await waitStatus('playing');
      if (id === 'shooter') {
        await page.keyboard.down('Space');
        assert.equal(await held(), 1);
        await page.waitForTimeout(180);
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', {configurable: true, value: true});
          document.dispatchEvent(new Event('visibilitychange'));
          delete document.hidden;
        });
        await waitStatus('paused');
        assert.equal(await held(), 0);
        await page.keyboard.up('Space');
        await page.locator('#pause').click();
        await waitStatus('playing');
        assert.equal(await held(), 0);
        await page.keyboard.down('Space');
        assert.equal(await held(), 1);
        await page.keyboard.up('Space');
        assert.equal(await held(), 0);
        row.actions.push('held input, hidden pause, manual resume, re-input and release');
      } else {
        for (const move of ['left', 'up', 'right']) {
          await page.locator('button[data-action="' + move + '"]').click();
          await page.waitForTimeout(90);
        }
        await waitStatus('won');
        row.actions.push('three actions reach the goal');
      }
      await shot('action');
      await page.locator('#restart').click();
      await waitStatus('playing');
      await page.locator('#pause').click();
      await waitStatus('paused');
      await page.locator('#pause').click();
      await waitStatus('playing');
      await page.locator('#dispose').click();
      await waitStatus('disposed');
      assert.equal(await held(), 0);
      assert.equal(await page.locator('#game canvas').count(), 0);
      assert.deepEqual(row.errors, []);
      row.actions.push('restart, pause, resume and dispose');
      row.status = 'PASS';
    } catch (error) {
      row.failure = String(error);
      row.statusText = await page.locator('#status').textContent({timeout: 1000}).catch(() => null);
    } finally {
      await context.close();
    }
  }
  assert(report.cases.every((row) => row.status === 'PASS'));
  report.status = 'PASS';
} catch (error) {
  process.exitCode = 1;
  report.failure = String(error);
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
  await writeFile(resolve(out, 'summary.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify(report));
}
