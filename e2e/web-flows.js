const { chromium } = require('playwright');
const serve = require('./serve');
const OUT = process.argv[2] ?? require('path').resolve(__dirname, '..', 'docs', 'screenshots');
const URL = 'http://localhost:8081/';
(async () => {
  const server = await serve(8081);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`.slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
  const t0 = Date.now();
  await page.goto(URL);
  await page.getByText('Try the demo garden').waitFor();
  await shot('01-home');
  await page.getByText('Try the demo garden').click();
  await page.waitForTimeout(400);
  await shot('02-demo-intro-start');
  await page.waitForTimeout(2200);
  await shot('03-demo-3d');
  // canvas must exist and not be blank
  const canvasInfo = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    const gl = c.getContext('webgl2');
    return { w: c.width, h: c.height, webgl2: !!gl };
  });
  console.log('canvas', JSON.stringify(canvasInfo));
  // Sun: jump to 21 Dec and scrub the time
  await page.getByText('21 Dec', { exact: true }).click();
  await page.waitForTimeout(300);
  const scrub = page.getByLabel('Time of day in garden time');
  const box = await scrub.boundingBox();
  await page.mouse.click(box.x + box.width * (9.5 / 24), box.y + box.height / 2);
  await page.waitForTimeout(500);
  await shot('04-sun-dec-0930');
  const sunText1 = await page.getByText(/Sun .* above the horizon|below the horizon/).first().innerText();
  await page.mouse.move(box.x + box.width * (9.5 / 24), box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 0; i <= 20; i++) await page.mouse.move(box.x + box.width * ((9.5 + i * 0.25) / 24), box.y + box.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const sunText2 = await page.getByText(/Sun .* above the horizon|below the horizon/).first().innerText();
  await shot('05-sun-dec-1445');
  console.log('sun readouts:', sunText1, '|', sunText2);
  await page.getByText('21 Jun', { exact: true }).click();
  await page.waitForTimeout(500);
  await shot('06-sun-jun');
  // Orbit drag on canvas
  const cv = await page.locator('canvas').boundingBox();
  await page.mouse.move(cv.x + cv.width / 2, cv.y + cv.height / 2);
  await page.mouse.down();
  await page.mouse.move(cv.x + cv.width / 2 + 120, cv.y + cv.height / 2 + 30, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await shot('07-orbited');
  // Add a tree
  await page.getByText('+ Add', { exact: true }).click();
  await page.getByLabel('Add Tree').click();
  await page.waitForTimeout(500);
  await shot('08-tree-added');
  await page.getByText('Tree', { exact: true }).waitFor();
  await page.getByLabel('Increase Height').click();
  await page.getByLabel('Increase Height').click();
  await page.waitForTimeout(300);
  await shot('09-tree-taller');
  // Drag the selected tree (Move objects mode is on after adding)
  await page.getByLabel('Reset camera').click();
  await page.waitForTimeout(900);
  await page.mouse.move(cv.x + cv.width / 2, cv.y + cv.height / 2);
  await page.mouse.down();
  await page.mouse.move(cv.x + cv.width / 2 - 60, cv.y + cv.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await shot('10-tree-dragged');
  const posText = await page.getByText(/Position: .* east/).innerText().catch(() => 'n/a');
  console.log('tree position after drag:', posText);
  await page.getByText('ⓘ Garden').click();
  await page.waitForTimeout(300);
  await shot('11-info');
  await page.getByLabel('Top-down view').click();
  await page.waitForTimeout(900);
  await shot('12-topdown');
  // Persistence: reload and reopen the demo
  await page.waitForTimeout(800);
  const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('gardena')));
  console.log('stored keys', stored.length);
  await page.reload();
  await page.getByText('Your gardens').waitFor();
  await shot('13-home-after-reload');
  const cardText = await page.getByText(/objects · sample data/).first().innerText();
  console.log('after reload card:', cardText);

  // Draw a new concave garden on the grid
  await page.getByText('Find your garden').click();
  await page.waitForTimeout(500);
  await page.getByLabel('Search for an address').fill('50.0868, 19.9002');
  await page.getByText('Search', { exact: true }).click();
  await page.waitForTimeout(500);
  await shot('14-search-coords');
  await page.getByText(/^50\.08680, 19\.90020$/).click();
  await page.waitForTimeout(400);
  await page.getByRole('tab', { name: '✎  Draw outline' }).click();
  await page.waitForTimeout(300);
  const mp = await page.getByLabel('Drawing area. Tap to add a boundary corner.').boundingBox();
  const cx = mp.x + mp.width / 2, cy = mp.y + mp.height / 2;
  const L = [[-110, -90], [110, -90], [110, 10], [10, 10], [10, 100], [-110, 100]];
  for (const [dx, dy] of L) { await page.mouse.click(cx + dx, cy + dy); await page.waitForTimeout(120); }
  await shot('15-drawing-open');
  // undo + redo last point
  await page.getByText('Undo', { exact: true }).click();
  await page.waitForTimeout(150);
  await page.mouse.click(cx - 110, cy + 100);
  await page.waitForTimeout(150);
  await page.getByText('Close shape', { exact: true }).click();
  await page.waitForTimeout(300);
  // drag a corner to make a self-intersection, check error, then undo
  await page.mouse.move(cx + 110, cy + 10); await page.mouse.down(); await page.mouse.move(cx - 150, cy + 40, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(300);
  await shot('16-self-intersection');
  const crossMsg = await page.getByText(/crosses itself/).count();
  console.log('self-intersection message shown:', crossMsg > 0);
  await page.getByText('Undo', { exact: true }).click();
  await page.waitForTimeout(300);
  await shot('17-closed-valid');
  const areaText = await page.getByText(/Area ≈/).innerText();
  console.log('drawn area:', areaText);
  await page.getByText('Confirm', { exact: true }).click();
  for (const [i, ms] of [[0, 120], [1, 250], [2, 450], [3, 700], [4, 1300]]) { await page.waitForTimeout(ms - (i ? [120, 250, 450, 700][i - 1] : 0)); await shot(`18-transition-${i}`); }
  await page.waitForTimeout(1800);
  await shot('19-new-garden-3d');
  // Return to top-down editing
  await page.getByText('Edit outline').click();
  await page.waitForTimeout(1400);
  await shot('20-edit-outline');
  console.log('elapsed', Date.now() - t0, 'ms');
  console.log('console errors/warnings:\n' + errors.join('\n'));
  await browser.close();
  server.close();
})().catch((e) => { console.error('E2E FAILED', e); process.exit(1); });
