import { chromium } from 'playwright';
const OUT = process.argv[2];
const base = 'http://127.0.0.1:4810/api-validator';
const pages = { home: '/', ptbr: '/pt-br/', cpf: '/utils/cpf/', plate: '/utils/license-plate/', libjs: '/libs/javascript/', libpy: '/libs/python/', parity: '/reference/parity/', guide: '/guides/javascript/document-field/', specs: '/contributing/specs/', start: '/getting-started/', nf: '/does-not-exist/' };
const vps = { d: { width: 1440, height: 900 }, m: { width: 390, height: 844 } };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const report = [];
for (const theme of ['light', 'dark']) for (const [vk, vp] of Object.entries(vps)) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: theme, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  for (const [k, u] of Object.entries(pages)) {
    await page.goto(base + u, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight, dark: document.documentElement.classList.contains('dark') }));
    report.push(`${theme} ${vk} ${k} scrollW=${info.sw} clientW=${info.cw} H=${info.h} dark=${info.dark}`);
    await page.screenshot({ path: `${OUT}/${k}-${vk}-${theme}.png`, fullPage: true });
    await page.screenshot({ path: `${OUT}/${k}-${vk}-${theme}-fold.png` });
  }
  await ctx.close();
}
console.log(report.join('\n'));
await b.close();
