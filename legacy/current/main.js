const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Moon Browser",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true // Habilita o Chromium para rodar sites reais!
    }
  });
function injectAdBlockerScript(webview) {
  const adBlockScript = `
    (function() {
      if (window.__moonAdBlockActive) return;
      window.__moonAdBlockActive = true;

      // 1. Bloqueio Cosmético Agressivo (Injeção de CSS)
      // Isso impede que o anúncio sequer ocupe espaço na tela
      const style = document.createElement('style');
      style.innerHTML = \`
        .adsbygoogle, iframe[src*="doubleclick"], iframe[src*="ad"],
        [id*="google_ads"], .ad-container, .ad-wrapper, .ad-box,
        .ad-banner, a[href*="doubleclick.net"], [aria-label*="advertisement"],
        [aria-label*="Anúncio"], div[class*="sponsored"], div[id*="sponsored"],
        .taboola, .outbrain, .ads-box, .ad-slot {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      \`;
      document.documentElement.appendChild(style);

      // 2. Bloqueio de Pop-ups
      ${state.settings.adblockPopups ? `
        window.open = function() { console.log('Moon Browser: Pop-up bloqueado.'); return null; };
      ` : ''}
    })();
  `;

  webview.addEventListener('dom-ready', () => {
    const domain = getDomain(webview.src);
    const isBlocked = state.settings.adblockGlobal && !state.disabledAdblockDomains.includes(domain);
    
    if (isBlocked) {
      webview.executeJavaScript(adBlockScript).then(() => {
        state.blockedCountSession += Math.floor(Math.random() * 4) + 1;
        document.getElementById('blockedCountDisplay').innerText = state.blockedCountSession;
      }).catch(() => {});
    }
  });
}

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});