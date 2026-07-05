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
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ farms: farmData }));
    }
  });
}

app.use(express.static('public'));
setInterval(updateFarms, 8000);
updateFarms();

server.listen(8080, () => console.log('Dashboard läuft auf Port 8080'));
