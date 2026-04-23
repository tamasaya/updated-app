import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs/promises'
// import { registerSpotreadIpc } from './spotread'

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

  // registerSpotreadIpc(() => mainWindow)

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
      {
        windowsHide: true
      }
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
      resolve({
        ok: false,
        stdout,
        stderr: error.message
      })
    })

    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr
      })
    })
  })
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
