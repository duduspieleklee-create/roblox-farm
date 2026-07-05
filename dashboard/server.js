const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const farmUrls = ['http://farm-1:3000'];

let farmData = {};

async function updateFarms() {
  for (const url of farmUrls) {
    try {
      const res = await axios.get(url + '/status', { timeout: 4000 });
      farmData[url] = res.data;
    } catch (e) {
      farmData[url] = { error: true };
    }
  }
  broadcast();
}

function broadcast() {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && !client.isControl) {
      client.send(JSON.stringify({ farms: farmData }));
    }
  });
}

app.use(express.static('public'));
setInterval(updateFarms, 8000);
updateFarms();

app.post('/api/restart/:farmIdx/:tabId', async (req, res) => {
  const farmUrl = farmUrls[parseInt(req.params.farmIdx)];
  if (!farmUrl) return res.status(404).json({ error: 'unbekannte Farm' });

  try {
    const r = await axios.post(`${farmUrl}/tabs/${encodeURIComponent(req.params.tabId)}/restart`, null, { timeout: 4000 });
    res.json(r.data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

wss.on('connection', (browserWs, req) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/control') return;

  browserWs.isControl = true;

  const farmIdx = parseInt(url.searchParams.get('farm')) || 0;
  const tabId = url.searchParams.get('tab');
  const farmBase = (farmUrls[farmIdx] || farmUrls[0]).replace(/^http/, 'ws');
  const farmWs = new WebSocket(`${farmBase}/control?tab=${encodeURIComponent(tabId)}`);

  farmWs.on('message', (data, isBinary) => {
    if (browserWs.readyState === WebSocket.OPEN) browserWs.send(data, { binary: isBinary });
  });
  farmWs.on('close', () => browserWs.close());
  farmWs.on('error', () => browserWs.close());

  browserWs.on('message', (data, isBinary) => {
    if (farmWs.readyState === WebSocket.OPEN) farmWs.send(data, { binary: isBinary });
  });
  browserWs.on('close', () => farmWs.close());
  browserWs.on('error', () => farmWs.close());
});

server.listen(8080, () => console.log('Dashboard läuft auf Port 8080'));
