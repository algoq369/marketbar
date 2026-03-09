import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
  shell,
  nativeTheme,
} from 'electron'
import { join } from 'path'
import Store from 'electron-store'

const WINDOW_WIDTH = 420
const WINDOW_HEIGHT = 680
const IS_DEV = !app.isPackaged

const store = new Store({
  defaults: {
    watchlist: ['sp500', 'gold', 'oil-wti', 'bitcoin', 'ethereum'],
    refreshInterval: 60,
    launchAtLogin: false,
    theme: 'dark',
  },
})

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let tickerText = '◈ MARKETBAR'

function createTrayIcon(): nativeImage {
  const size = 22
  const canvas = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 22 22">
      <path d="M3 16 L6 10 L9 13 L13 6 L16 9 L19 4" 
            stroke="black" stroke-width="2" stroke-linecap="round" 
            stroke-linejoin="round" fill="none"/>
      <circle cx="19" cy="4" r="2" fill="black"/>
    </svg>
  `
  const icon = nativeImage.createFromBuffer(
    Buffer.from(canvas.trim())
  )
  icon.setTemplateImage(true)
  return icon
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    transparent: false,
    backgroundColor: '#0c0e13',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    hasShadow: true,
    roundedCorners: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  if (IS_DEV) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('blur', () => {
    if (!IS_DEV) {
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function showWindow() {
  if (!mainWindow || !tray) return

  const trayBounds = tray.getBounds()
  const windowBounds = mainWindow.getBounds()
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  })

  const x = Math.round(
    trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2
  )
  const y = Math.round(trayBounds.y + trayBounds.height + 4)

  const clampedX = Math.max(
    display.workArea.x,
    Math.min(x, display.workArea.x + display.workArea.width - windowBounds.width)
  )

  mainWindow.setPosition(clampedX, y)
  mainWindow.show()
  mainWindow.focus()
}

function toggleWindow() {
  if (!mainWindow) {
    createWindow()
    setTimeout(showWindow, 100)
    return
  }
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    showWindow()
  }
}

function createTray() {
  const icon = createTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip('MarketBar — Market Tracker')
  updateTrayTitle()

  tray.on('click', () => {
    toggleWindow()
  })

  tray.on('right-click', () => {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'MarketBar v1.0', enabled: false },
      { type: 'separator' },
      { label: 'Show Window', click: () => toggleWindow() },
      {
        label: 'Refresh Data',
        click: () => { mainWindow?.webContents.send('refresh-data') },
      },
      { type: 'separator' },
      {
        label: 'Launch at Login',
        type: 'checkbox',
        checked: store.get('launchAtLogin') as boolean,
        click: (item) => {
          store.set('launchAtLogin', item.checked)
          app.setLoginItemSettings({ openAtLogin: item.checked, openAsHidden: true })
        },
      },
      { type: 'separator' },
      { label: 'Quit MarketBar', accelerator: 'CmdOrCtrl+Q', click: () => { app.quit() } },
    ])
    tray?.popUpContextMenu(contextMenu)
  })
}

function updateTrayTitle() {
  if (!tray) return
  tray.setTitle(tickerText, { fontType: 'monospacedDigit' })
}

function setupIPC() {
  ipcMain.on('update-ticker', (_event, text: string) => {
    tickerText = text
    updateTrayTitle()
  })

  ipcMain.handle('store-get', (_event, key: string) => {
    return store.get(key)
  })

  ipcMain.handle('store-set', (_event, key: string, value: any) => {
    store.set(key, value)
  })

  ipcMain.on('hide-window', () => {
    mainWindow?.hide()
  })

  ipcMain.on('open-external', (_event, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('get-theme', () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  ipcMain.on('set-window-size', (_event, width: number, height: number) => {
    mainWindow?.setSize(width, height)
  })
}

app.whenReady().then(() => {
  setupIPC()
  createTray()
  createWindow()

  const launchAtLogin = store.get('launchAtLogin') as boolean
  app.setLoginItemSettings({ openAtLogin: launchAtLogin, openAsHidden: true })
})

app.on('window-all-closed', (e: Event) => {
  e.preventDefault()
})

app.on('activate', () => {
  if (!mainWindow) createWindow()
  showWindow()
})

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) showWindow()
  })
}
