import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, extname } from 'path'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fsp from 'fs/promises'
import fs from 'node:fs'
import path from 'node:path'

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  mainWindow = createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('pick-npy-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Выберите .npy файл',
    properties: ['openFile'],
    filters: [
      { name: 'NumPy files', extensions: ['npy'] },
      { name: 'All files', extensions: ['*'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle('read-npy-file', async (_event, filePath: string) => {
  if (extname(filePath).toLowerCase() !== '.npy') {
    throw new Error('Разрешены только .npy файлы')
  }

  const file = await fsp.readFile(filePath)

  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
})

ipcMain.handle('run-predict', async () => {
  return await new Promise((resolve) => {
    const child = spawn(
      'wsl.exe',
      [
        '--distribution',
        'Ubuntu',
        '/bin/bash',
        '-lc',
        'cd ~/projects/spectral-reconstruction-experimental && /home/user/miniforge3/condabin/mamba run -n night_2 python predict_image.py'
      ],
      { windowsHide: true }
    )

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += Buffer.from(data).toString('utf8')
    })

    child.stderr.on('data', (data) => {
      const textUtf8 = Buffer.from(data).toString('utf8')
      const textUtf16 = Buffer.from(data).toString('utf16le')
      stderr += textUtf8.includes('\u0000') ? textUtf16 : textUtf8
    })

    child.on('error', (error) => {
      resolve({ ok: false, stdout, stderr: error.message, outputPath: null })
    })

    child.on('close', (code) => {
      const outputPath = 'C:\\Users\\User\\repo\\saved\\test_pred_hsi.npy'
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr,
        outputPath: code === 0 ? outputPath : null
      })
    })
  })
})

function getChartWorkerExePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'python', 'chart-worker', 'chart-worker.exe')
  }

  return path.join(process.cwd(), 'python-helper', 'dist', 'chart-worker', 'chart-worker.exe')
}

ipcMain.handle('read-image-file', async (_event, filePath: string) => {
  const buffer = fs.readFileSync(filePath)

  return {
    filePath,
    bytes: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  }
})

ipcMain.handle('run-seaborn-chart', async (_event, npyPath: string) => {
  return await new Promise((resolve) => {
    const exePath = getChartWorkerExePath()
    const outputPath = path.join(app.getPath('temp'), `chart-${Date.now()}.png`)

    if (!fs.existsSync(exePath)) {
      resolve({
        ok: false,
        error: `Chart worker not found: ${exePath}`
      })
      return
    }

    const child = spawn(exePath, [npyPath, outputPath], {
      windowsHide: true
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString('utf8')
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString('utf8')
    })

    child.on('error', (error) => {
      resolve({
        ok: false,
        error: error.message,
        stdout,
        stderr
      })
    })

    child.on('close', () => {
      try {
        const parsed = JSON.parse(stdout.trim())
        resolve(parsed)
      } catch {
        resolve({
          ok: false,
          error: 'Invalid JSON from chart worker',
          stdout,
          stderr
        })
      }
    })
  })
})
