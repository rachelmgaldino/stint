import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const looks = process.argv[2].split(',');
const only = process.argv[3]; // optional filter
const out = '/tmp/claude-0/shots/';
const b = await chromium.launch();
const views = [
  ['desk', 1440, 900], ['phone', 390, 844],
];
async function page(vp, look, theme) {
  const ctx = await b.newContext({ viewport: { width: vp[1], height: vp[2] }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:5199/');
  await p.waitForTimeout(500);
  await p.evaluate(([theme, look]) => {
    const d = JSON.parse(localStorage.getItem('stint-demo'));
    d.settings.theme = theme; d.settings.look = look;
    localStorage.setItem('stint-demo', JSON.stringify(d));
  }, [theme, look]);
  await p.goto('http://localhost:5199/');
  await p.waitForTimeout(1300);
  return [ctx, p];
}
for (const look of looks) {
  for (const vp of views) {
    for (const theme of ['light', 'dark']) {
      const tag = `${look}-${vp[0]}-${theme}`;
      const [ctx, p] = await page(vp, look, theme);
      if (!only || only === 'timer') await p.screenshot({ path: `${out}${tag}-timer.png` });
      if (!only || only === 'analytics') {
        await p.getByRole('button', { name: 'Analytics' }).or(p.getByRole('link', { name: 'Analytics' })).first().click();
        await p.waitForTimeout(600);
        await p.getByRole('button', { name: 'Week', exact: true }).first().click().catch(() => {});
        await p.waitForTimeout(900);
        await p.screenshot({ path: `${out}${tag}-analytics.png` });
        await p.getByRole('button', { name: 'Timer' }).or(p.getByRole('link', { name: 'Timer' })).first().click();
        await p.waitForTimeout(500);
      }
      if ((!only || only === 'running') && theme === 'light') {
        await p.getByRole('button', { name: /Start focusing/ }).first().click();
        await p.waitForTimeout(1500);
        await p.screenshot({ path: `${out}${look}-${vp[0]}-running.png` });
      }
      await ctx.close();
    }
  }
  for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto(`http://localhost:5199/?float&look=${look}&theme=${theme}&desk=1&open=1`);
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${out}${look}-bubble-${theme}.png` });
    await p.goto(`http://localhost:5199/?float&look=${look}&theme=${theme}`);
    await p.waitForTimeout(1000);
    await p.screenshot({ path: `${out}${look}-bubbles-${theme}.png`, clip: { x: 0, y: 0, width: 900, height: 290 } });
    await ctx.close();
  }
}
await b.close();
