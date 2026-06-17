import { BrowserWindow, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import * as pty from 'node-pty'

type SpotreadState =
  | 'idle'
  | 'starting'
  | 'awaitingCalibration'
  | 'readyToMeasure'
  | 'measuring'
  | 'error'
  | 'exited'

type StartPayload = {
  argyllBinDir: string
  instrumentPort: number
}

type Measurement = {
  spectrum?: number[]
  xyz?: [number, number, number]
  lab?: [number, number, number]
  rawText: string
}

const READY_PROMPT = 'Hit ESC or Q to exit, instrument switch or any other key to take a reading:'

export function registerSpotreadIpc(getMainWindow: () => BrowserWindow | null) {
  let ptyProcess: pty.IPty | null = null
  let state: SpotreadState = 'idle'

  // Хвост входящего потока, который мы ещё не обработали
  let streamBuffer = ''

  // Уже входили в основной цикл "готов к измерению" или ещё нет
  let hasEnteredMeasurementLoop = false

  const send = (channel: string, payload: unknown) => {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send(channel, payload)
  }

  const setState = (next: SpotreadState) => {
    if (state === next) return
    state = next
    send('spotread:state', next)
  }

  const resetBuffers = () => {
    streamBuffer = ''
    hasEnteredMeasurementLoop = false
  }

  const parseMeasurement = (rawText: string): Measurement | null => {
    const xyzMatch = rawText.match(
      /Result is XYZ:\s*([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+),\s*D50 Lab:\s*([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)/s
    )

    const spectrumMatch = rawText.match(/Spectrum from .*?steps\s*([\s\S]*?)\s*Peak value/s)

    let spectrum: number[] | undefined

    if (spectrumMatch) {
      spectrum = spectrumMatch[1]
        .replace(/\r/g, ' ')
        .replace(/\n/g, ' ')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => Number(item))
        .filter((n) => !Number.isNaN(n))
    }

    if (!xyzMatch && (!spectrum || spectrum.length === 0)) {
      return null
    }

    return {
      spectrum,
      xyz: xyzMatch ? [Number(xyzMatch[1]), Number(xyzMatch[2]), Number(xyzMatch[3])] : undefined,
      lab: xyzMatch ? [Number(xyzMatch[4]), Number(xyzMatch[5]), Number(xyzMatch[6])] : undefined,
      rawText
    }
  }

  const handleOutput = (data: string) => {
    // Сырой лог всегда сразу отправляем в UI,
    // даже если дальше парсер где-то упадёт
    send('spotread:raw', data)

    try {
      streamBuffer += data

      if (streamBuffer.includes('Spot read needs a calibration before continuing')) {
        setState('awaitingCalibration')
      }

      if (streamBuffer.includes('Calibration complete')) {
        setState('readyToMeasure')
      }

      if (streamBuffer.includes('Spectrum from ')) {
        setState('measuring')
      }

      // Prompt используем как разделитель блоков.
      // До первого prompt мы просто входим в режим ожидания измерений.
      // Каждый следующий prompt означает: предыдущий блок завершён.
      let promptIndex = streamBuffer.indexOf(READY_PROMPT)

      while (promptIndex !== -1) {
        const beforePrompt = streamBuffer.slice(0, promptIndex)
        const afterPrompt = streamBuffer.slice(promptIndex + READY_PROMPT.length)

        if (hasEnteredMeasurementLoop) {
          const measurement = parseMeasurement(beforePrompt)

          console.log('MEASUREMENT_RAW_BLOCK', beforePrompt)
          console.log('MEASUREMENT_PARSED', measurement)

          if (measurement) {
            send('spotread:measurement', measurement)
          }
        } else {
          hasEnteredMeasurementLoop = true
        }

        streamBuffer = afterPrompt
        setState('readyToMeasure')

        promptIndex = streamBuffer.indexOf(READY_PROMPT)
      }

      if (streamBuffer.includes('Diagnostic:') || /\berror\b/i.test(streamBuffer)) {
        setState('error')
      }

      if (streamBuffer.length > 12000) {
        streamBuffer = streamBuffer.slice(-12000)
      }
    } catch (error) {
      console.error('spotread handleOutput error:', error)
      send('spotread:raw', `\r\n[PARSER ERROR] ${String(error)}\r\n`)
      setState('error')
    }
  }

  const writeKey = (value: string) => {
    if (!ptyProcess) {
      throw new Error('spotread не запущен')
    }
    ptyProcess.write(value)
  }

  ipcMain.handle('spotread:start', async (_event, payload: StartPayload) => {
    if (ptyProcess) return

    const exePath = path.join(payload.argyllBinDir, 'spotread.exe')

    if (!fs.existsSync(exePath)) {
      setState('error')
      throw new Error(`Не найден spotread.exe: ${exePath}`)
    }

    resetBuffers()
    setState('starting')

    ptyProcess = pty.spawn(exePath, ['-e', '-s', `-c${payload.instrumentPort}`], {
      name: 'xterm-color',
      cols: 120,
      rows: 40,
      cwd: payload.argyllBinDir,
      env: process.env as Record<string, string>
    })

    send('spotread:raw', `\r\n[spotread started: ${exePath} -e -s -c${payload.instrumentPort}]\r\n`)

    ptyProcess.onData((data) => {
      handleOutput(data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      send('spotread:raw', `\r\n[spotread exited with code ${exitCode}]\r\n`)
      ptyProcess = null
      resetBuffers()
      setState('exited')
    })
  })

  ipcMain.handle('spotread:stop', async () => {
    if (!ptyProcess) return
    writeKey('\x1b')
  })

  ipcMain.handle('spotread:calibrate', async () => {
    if (!ptyProcess) {
      throw new Error('spotread не запущен')
    }

    if (state === 'awaitingCalibration') {
      writeKey(' ')
      return
    }

    if (state === 'readyToMeasure') {
      writeKey('k')
      return
    }

    writeKey(' ')
  })

  ipcMain.handle('spotread:measure', async () => {
    if (!ptyProcess) {
      throw new Error('spotread не запущен')
    }

    setState('measuring')
    writeKey(' ')
  })

  ipcMain.handle('spotread:saveSpectrum', async () => {
    writeKey('s')
  })

  ipcMain.handle('spotread:setReference', async () => {
    writeKey('r')
  })
}
