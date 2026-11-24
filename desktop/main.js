// Part-Time Pilot — desktop wrapper (Electron). Opens the browser game in its own window.
// The game files are copied into ./app by build.js; during development (npm start) it falls back
// to the game in the repository root.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function gameIndex() {
  const packaged = path.join(__dirname, 'app', 'index.html');
  return fs.existsSync(packaged) ? packaged : path.join(__dirname, '..', 'index.html');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 800,
    minHeight: 480,
    title: 'Part-Time Pilot',
    backgroundColor: '#040306',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.removeMenu();
  win.loadFile(gameIndex());
  // F11 toggles fullscreen, like in a browser
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
  // the game never navigates; open any external link in the real browser instead
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) e.preventDefault();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
