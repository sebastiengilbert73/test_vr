import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import os from 'os';

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips.length > 0 ? ips : ['localhost'];
}

export default defineConfig({
  plugins: [
    basicSsl(),
    {
      name: 'voice-command-api',
      configureServer(server) {
        let lastCommand = null;
        let commandTimestamp = 0;

        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/api/command')) {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', () => {
                try {
                  const data = JSON.parse(body);
                  lastCommand = data.command;
                  commandTimestamp = Date.now();
                  res.writeHead(200, { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                  });
                  res.end(JSON.stringify({ success: true, command: lastCommand, timestamp: commandTimestamp }));
                } catch (e) {
                  res.writeHead(400);
                  res.end('Invalid JSON');
                }
              });
            } else if (req.method === 'GET') {
              res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify({ command: lastCommand, timestamp: commandTimestamp }));
            } else if (req.method === 'OPTIONS') {
              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
              });
              res.end();
            }
          } else {
            next();
          }
        });
      }
    }
  ],
  server: {
    host: true, // Écouter sur toutes les interfaces réseau
    port: 5173,
    https: true // Activer HTTPS pour le contexte sécurisé WebXR
  },
  define: {
    __LOCAL_IPS__: JSON.stringify(getLocalIPs())
  }
});
