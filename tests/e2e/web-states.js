const { chromium } = require('playwright');
const serve = require('./serve');
const OUT = process.argv[2] ?? require('path').resolve(__dirname, 'output');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const server = await serve(8081);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce', timezoneId: 'America/New_York' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:8081/');
  // 1) search failure (provider endpoints are unreachable in this sandbox)
  await page.getByText('Find your garden').click();
  await page.getByLabel('Search for an address').fill('Rynek Główny 1, Kraków');
  await page.getByText('Search', { exact: true }).click();
  await page.getByText(/No matches found|Could not reach/).first().waitFor({ timeout: 20000 });
  console.log('search failure text:', (await page.getByText(/No matches found/).first().innerText()).slice(0, 200));
  await page.screenshot({ path: `${OUT}/state-search-failed.png` });
  // 2) draw quickly and confirm with reduced motion → no morph, final view immediately
  await page.getByLabel('Search for an address').fill('52.2297, 21.0122');
  await page.getByText('Search', { exact: true }).click();
  await page.getByText(/^52\.22970, 21\.01220$/).click();
  await page.getByRole('tab', { name: '✎  Draw outline' }).click();
  const mp = await page.getByLabel('Drawing area. Tap to add a boundary corner.').boundingBox();
  const cx = mp.x + mp.width / 2, cy = mp.y + mp.height / 2;
  for (const [dx, dy] of [[-80, -60], [80, -60], [80, 60], [-80, 60]]) await page.mouse.click(cx + dx, cy + dy);
  await page.mouse.click(cx - 80, cy - 60); // tap first corner closes
  await page.getByText('Confirm', { exact: true }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/state-reduced-motion-250ms.png` });
  // garden time vs phone time (browser in New York, garden in Warsaw)
  console.log('phone line:', await page.getByText(/Your phone:/).innerText());
  // 3) surrounding buildings unavailable
  await page.getByText('ⓘ Garden').click();
  await page.getByText(/Load buildings within/).click();
  await page.getByText(/Could not load surrounding buildings|answered/).first().waitFor({ timeout: 30000 });
  console.log('context failure text:', await page.getByText(/Could not load surrounding buildings|answered/).first().innerText());
  await page.screenshot({ path: `${OUT}/state-osm-failed.png` });
  await browser.close();
  server.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
