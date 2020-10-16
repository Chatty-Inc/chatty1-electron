const contextMenu = require('electron-context-menu');

const { app, BrowserWindow, session } = require('electron');

contextMenu({
    showInspectElement: false
});

app.allowRendererProcessReuse = true;

function createWindow () {
    // Create the browser window.
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 350,
        minHeight: 500,
        backgroundColor: '#000',
        frame: false,
        show: false,
        icon: __dirname + 'img/icon.ico',
        maximizable: true,
        webPreferences: {
            nodeIntegration: true,
            spellcheck: true,
            enableRemoteModule: true,
            webviewTag: true
        },
    });
    win.setMenuBarVisibility(false); // Remove menu bar

    // Fake httpReferer to allow playing of youtube videos
    win.webContents.session.webRequest.onBeforeSendHeaders({ urls: [ "*://*/*" ] }, (details, callback) => {
        callback({
            requestHeaders: {
                ...details.requestHeaders,
                Referer: 'https:/ /www.youtube-nocookie.com',
            }
        });
    });

    // Also remove CORS and iFrame options
    win.webContents.session.webRequest.onHeadersReceived({ urls: [ "*://*/*" ] },
        (d, c)=>{
            if(d.responseHeaders['X-Frame-Options']){
                delete d.responseHeaders['X-Frame-Options'];
            } else if(d.responseHeaders['x-frame-options']) {
                delete d.responseHeaders['x-frame-options'];
            }

            c({cancel: false, responseHeaders: d.responseHeaders});
        }
    );

    win.loadFile('loader.html');
    win.once('ready-to-show', () => {
        win.show();
    })
}

app.whenReady().then(createWindow);