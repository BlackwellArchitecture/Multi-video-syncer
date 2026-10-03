/**
 * Video Syncer - Desktop Application Main Process
 * Electron main process with GPU zero-copy acceleration and native disk range-streaming.
 * Strictly zero emojis.
 */

const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

// Configure Chromium GPU and Video Decoding Switches
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-hardware-overlays');
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,VaapiVideoDecoder');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('max-active-webgl-contexts', '32');

// Register custom protocol for high-performance direct disk streaming
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media-stream',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
]);

const MIME_MAP = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.ts': 'video/mp2t',
  '.m4v': 'video/mp4'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'video/mp4';
}

function parseFilePathFromUrl(requestUrl) {
  try {
    const urlObj = new URL(requestUrl);
    let filePath = decodeURIComponent(urlObj.pathname);
    if (urlObj.host && urlObj.host !== 'stream' && urlObj.host !== 'local') {
      filePath = urlObj.host + filePath;
    }
    // Remove leading slash if before drive letter, e.g. /L:/ or /C:/
    filePath = filePath.replace(/^\/([a-zA-Z]:)/, '$1');
    return path.normalize(filePath);
  } catch (err) {
    return '';
  }
}

function setupMediaStreamProtocol() {
  protocol.handle('media-stream', async (request) => {
    const filePath = parseFilePathFromUrl(request.url);

    if (!filePath || !fs.existsSync(filePath)) {
      return new Response('File Not Found', { status: 404 });
    }

    try {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = request.headers.get('range');
      const mime = getMimeType(filePath);

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize) {
          return new Response('Requested Range Not Satisfiable', {
            status: 416,
            headers: {
              'Content-Range': `bytes */${fileSize}`
            }
          });
        }

        const chunkSize = end - start + 1;
        const nodeStream = fs.createReadStream(filePath, { start, end });
        const webStream = Readable.toWeb(nodeStream);

        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': mime
          }
        });
      } else {
        const nodeStream = fs.createReadStream(filePath);
        const webStream = Readable.toWeb(nodeStream);

        return new Response(webStream, {
          status: 200,
          headers: {
            'Accept-Ranges': 'bytes',
            'Content-Length': String(fileSize),
            'Content-Type': mime
          }
        });
      }
    } catch (err) {
      console.error('Error streaming video file:', err);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0a0c10',
    autoHideMenuBar: true,
    title: 'Video Syncer - Multi-POV Precision Synchronizer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.loadFile('index.html');
}

// IPC Handlers
function setupIpcHandlers() {
  // Native Open Video Files Dialog
  ipcMain.handle('dialog:open-videos', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Video Files for Synchronization',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'webm', 'mkv', 'mov', 'avi', 'ts', 'm4v'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePaths.length) {
      return [];
    }

    return result.filePaths.map((fullPath) => {
      const stat = fs.statSync(fullPath);
      return {
        path: fullPath,
        name: path.basename(fullPath),
        size: stat.size
      };
    });
  });

  // Native Export Session Dialog
  ipcMain.handle('dialog:export-session', async (event, sessionData) => {
    const result = await dialog.showSaveDialog({
      title: 'Export Sync Session Configuration',
      defaultPath: `video_sync_session_${Date.now()}.json`,
      filters: [{ name: 'JSON Configuration', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePath) {
      return { success: false };
    }

    fs.writeFileSync(result.filePath, JSON.stringify(sessionData, null, 2), 'utf-8');
    return { success: true, filePath: result.filePath };
  });

  // Native Import Session Dialog
  ipcMain.handle('dialog:import-session', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Sync Session Configuration',
      properties: ['openFile'],
      filters: [{ name: 'JSON Configuration', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }

    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    return JSON.parse(content);
  });
}

app.whenReady().then(() => {
  setupMediaStreamProtocol();
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
