/*
 * .cjs는 CommonJS JavaScript 파일 확장자입니다.
 * package.json의 module 설정과 관계없이 Electron main process가 require()
 * 방식으로 이 파일을 로드하도록 고정할 때 사용합니다.
 */
const { app, BrowserWindow, dialog } = require('electron/main');
const { getDesktopConfig, startManagedProcesses, stopManagedProcesses, waitForHttp } = require('./services.cjs');

let managedProcesses = [];
let mainWindow = null;

function createWindow(config) {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 1000,
        minWidth: 1120,
        minHeight: 760,
        backgroundColor: '#05070a',
        title: 'test-player',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    void mainWindow.loadURL(config.launchUrl);
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function shutdownManagedProcesses() {
    stopManagedProcesses(managedProcesses);
    managedProcesses = [];
}

async function bootDesktopApp() {
    const config = getDesktopConfig();

    managedProcesses = startManagedProcesses(config);

    const [isBackReady, isFrontReady] = await Promise.all([
        waitForHttp(config.apiReadyUrl),
        waitForHttp(config.frontUrl),
    ]);

    if (!isBackReady) {
        throw new Error(`Nest backend did not become ready at ${config.apiReadyUrl}`);
    }

    if (!isFrontReady) {
        throw new Error(`Next frontend did not become ready at ${config.frontUrl}`);
    }

    createWindow(config);
}

app.whenReady()
    .then(bootDesktopApp)
    .catch((error) => {
        shutdownManagedProcesses();
        dialog.showErrorBox('test-player failed to start', error instanceof Error ? error.message : String(error));
        app.quit();
    });

app.on('window-all-closed', () => {
    app.quit();
});

app.on('before-quit', () => {
    shutdownManagedProcesses();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && mainWindow === null) {
        const config = getDesktopConfig();
        createWindow(config);
    }
});
