const { chromium } = require('playwright');
const express = require('express');
const fs = require('fs');
const path = require('path');

const INSTANCE_ID = process.env.INSTANCE_ID || '1';
const MAX_TABS = parseInt(process.env.MAX_TABS) || 80;
const FPS_THROTTLE = parseInt(process.env.FPS_THROTTLE) || 7;
const TAB_COUNT = parseInt(process.env.TAB_COUNT) || 10;
const GAME_URL = process.env.GAME_URL || 'https://www.roblox.com/home';
const TAB_STAGGER_MS = parseInt(process.env.TAB_STAGGER_MS) || 1500;

const DATA_DIR = './data';
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

const app = express();
let browser = null;
const instances = new Map();

async function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    const placeholders = Array.from({ length: TAB_COUNT }, (_, i) => ({ id: `tab${i + 1}` }));
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(placeholders, null, 2));
    return placeholders;
  }
  return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openTab(account) {
  const record = { page: null, context: null, status: 'loading', openedAt: Date.now(), error: null };
  instances.set(account.id, record);

  const context = await browser.newContext();
  record.context = context;

  if (account.cookie) {
    await context.addCookies([
      {
        name: '.ROBLOSECURITY',
        value: account.cookie,
        domain: '.roblox.com',
        path: '/',
        httpOnly: true,
        secure: true
      }
    ]);
  }

  const page = await context.newPage();
  await applyOptimizations(page);
  page.on('close', () => {
    record.status = 'closed';
    context.close().catch(() => {});
  });

  try {
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    record.page = page;
    record.status = 'ready';
    console.log(`[${account.id}] geladen${account.cookie ? ' (eingeloggt)' : ' (Gast)'}`);
  } catch (err) {
    record.status = 'error';
    record.error = err.message;
    console.error(`[${account.id}] Fehler beim Laden: ${err.message}`);
    await page.close().catch(() => {});
  }
}

async function describeTab(id, record) {
  const base = {
    id,
    status: record.status,
    uptimeSec: Math.round((Date.now() - record.openedAt) / 1000),
    error: record.error,
    url: null,
    title: null
  };

  if (record.status !== 'ready' || !record.page || record.page.isClosed()) {
    return base;
  }

  base.url = record.page.url();
  try {
    base.title = await Promise.race([
      record.page.title(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
    ]);
  } catch (err) {
    base.title = null;
  }

  return base;
}

async function openTabs(accounts) {
  const toOpen = accounts.slice(0, MAX_TABS);
  for (const account of toOpen) {
    await openTab(account);
    await sleep(TAB_STAGGER_MS);
  }
}

async function applyOptimizations(page) {
  await page.addInitScript((fps) => {
    const interval = 1000 / fps;
    let last = Date.now();
    const orig = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => {
      if (Date.now() - last >= interval) {
        last = Date.now();
        return orig(cb);
      }
      return setTimeout(() => orig(cb), interval);
    };
  }, FPS_THROTTLE);

  await page.route('**/*', (route) => {
    const u = route.request().url().toLowerCase();
    if (u.includes('analytics') || u.includes('telemetry') || u.includes('ads') || u.includes('video')) {
      return route.abort();
    }
    return route.continue();
  });
}

app.get('/status', async (req, res) => {
  const mem = process.memoryUsage();
  const tabs = await Promise.all(
    Array.from(instances.entries()).map(([id, record]) => describeTab(id, record))
  );

  res.json({
    instanceId: INSTANCE_ID,
    tabs: tabs.length,
    maxTabs: MAX_TABS,
    ramMB: Math.round(mem.heapUsed / 1024 / 1024),
    tabList: tabs
  });
});

async function shutdown() {
  console.log(`Farm ${INSTANCE_ID} wird beendet...`);
  if (browser) await browser.close().catch(() => {});
  process.exit(0);
}

async function main() {
  await ensureDirs();
  browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--disable-webgl']
  });

  console.log(`Farm ${INSTANCE_ID} gestartet | Max Tabs: ${MAX_TABS}`);

  const accounts = loadAccounts();
  await openTabs(accounts);

  app.listen(3000, () => console.log(`Status Server auf Port 3000`));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch(console.error);
