// Zero-dependency static file server for Part-Time Pilot.
//   node server.js            -> serves on http://localhost:8080 and opens your browser
//   node server.js --no-open  -> serves without opening a browser
//   PORT=9000 node server.js  -> custom port
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const root = __dirname;
const port = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(root, p));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

let tryPort = port;
server.on('error', (err) => {
  // port busy (e.g. a previous copy is still running): try the next one
  if (err.code === 'EADDRINUSE' && tryPort < port + 20) {
    tryPort++;
    server.listen(tryPort);
  } else {
    console.error(err.message);
    process.exit(1);
  }
});
server.on('listening', () => {
  const url = `http://localhost:${server.address().port}/`;
  console.log(`Part-Time Pilot running at ${url}  (Ctrl+C to stop)`);
  if (!process.argv.includes('--no-open')) {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd, () => {});
  }
});
server.listen(tryPort);
