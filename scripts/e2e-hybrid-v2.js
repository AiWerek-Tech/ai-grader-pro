const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const port = Number(process.env.E2E_PORT || 3110);
  const baseUrl = `http://127.0.0.1:${port}`;
  const screenshotPath = path.join(process.cwd(), 'e2e-hybrid-v2.png');

  const payload = {
    title: 'E2E Hybrid Mixed V2',
    mapel: 'Sains Terpadu',
    totalSoal: 7,
    options: 'single_choice',
    questionConfig: [
      { no: 1, tipe: 'single_choice', opsi: ['A', 'B', 'C', 'D', 'E'] },
      { no: 2, tipe: 'true_false', opsi: ['B', 'S'] },
      { no: 3, tipe: 'multiple_select', opsi: ['A', 'B', 'C', 'D', 'E'] },
      { no: 4, tipe: 'multiple_true_false', jumlah_pernyataan: 3 },
      { no: 5, tipe: 'matching', jumlah_pasang: 3 },
      { no: 6, tipe: 'short_answer', panjang_jawaban: 5 },
      { no: 7, tipe: 'essay' },
    ],
    siswaList: [
      { nis: '95741135', nama: 'ARMAN MULAIT', kelas: 'X IPA 1', jenjang: 'SMA' },
    ],
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 2200 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('#login-username').fill(process.env.E2E_USERNAME || 'e2eadmin');
  await page.locator('#login-password').fill(process.env.E2E_PASSWORD || 'e2eadminsecure123');
  await page.locator('#btn-login-submit').click();
  await page.waitForTimeout(3000);
  const loginState = {
    url: page.url(),
    bodySnippet: (await page.locator('body').textContent()).slice(0, 400),
  };

  await page.addInitScript((printPayload) => {
    localStorage.setItem('WMVAA_PRINT_PAYLOAD', JSON.stringify(printPayload));
  }, payload);

  await page.goto(`${baseUrl}/print/ljk`, { waitUntil: 'networkidle' });
  await page.locator('.ljk-page').waitFor({ timeout: 20000 });

  await page.evaluate(() => {
    const fillCell = (questionNo, row, value) => {
      let selector = `[data-scan-question="${questionNo}"][data-scan-value="${value}"]`;
      if (row) selector += `[data-scan-row="${row}"]`;
      const cell = document.querySelector(selector);
      if (!cell) return false;
      const bubble = cell.querySelector('div');
      if (!bubble) return false;
      bubble.setAttribute(
        'style',
        'width:100%;height:100%;background:#000;box-shadow:inset 0 0 0 1px #000;border:1.5px solid #000;border-radius:inherit;'
      );
      return true;
    };

    fillCell(1, '', 'B');
    fillCell(2, '', 'S');
    ['A', 'C', 'E'].forEach((value) => fillCell(3, '', value));
    [['1', 'B'], ['2', 'S'], ['3', 'B']].forEach(([row, value]) => fillCell(4, row, value));
    [['1', 'C'], ['2', 'A'], ['3', 'B']].forEach(([row, value]) => fillCell(5, row, value));

    const questionBlocks = Array.from(document.querySelectorAll('.ljk-page .absolute.border-b'));
    const shortBlock = questionBlocks.find((element) => element.textContent && element.textContent.includes('6.'));
    if (shortBlock) {
      const text = document.createElement('div');
      text.textContent = 'BUMI';
      text.setAttribute(
        'style',
        'position:absolute;left:62px;top:18px;font-size:14px;font-weight:800;letter-spacing:6px;font-family:Arial,sans-serif;'
      );
      shortBlock.appendChild(text);
    }

    const essayHeading = Array.from(document.querySelectorAll('.ljk-page div')).find(
      (element) => element.textContent?.trim() === 'Area Jawaban Uraian (Esai)'
    );
    const essayArea = essayHeading ? essayHeading.parentElement : null;
    if (essayArea) {
      const paragraph = document.createElement('div');
      paragraph.textContent = 'EKOSISTEM HUTAN TROPIS MENJAGA KESEIMBANGAN AIR DAN KEANEKARAGAMAN HAYATI.';
      paragraph.setAttribute(
        'style',
        'font-size:11px;font-weight:700;line-height:1.6;margin-top:8px;text-transform:uppercase;'
      );
      essayArea.appendChild(paragraph);
    }
  });

  await page.locator('.ljk-page').screenshot({ path: screenshotPath });

  const imageBase64 = fs.readFileSync(screenshotPath).toString('base64');
  const scanPayload = {
    imageBase64,
    mimeType: 'image/png',
    totalSoal: payload.totalSoal,
    questionBlueprint: payload.questionConfig,
  };
  const result = await page.evaluate(async ({ targetUrl, body }) => {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    const json = await response.json();
    return { status: response.status, body: json };
  }, {
    targetUrl: `${baseUrl}/api/scan`,
    body: scanPayload,
  });

  console.log(JSON.stringify({
    loginState,
    screenshotPath,
    pageUrl: page.url(),
    status: result.status,
    result: result.body,
  }, null, 2));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
