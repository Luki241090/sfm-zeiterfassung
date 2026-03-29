import fs from 'fs';

const filePath = 'app.js';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add deferredPrompt to state
code = code.replace(/map:\s*null/g, 'map: null,\n        deferredPrompt: null');

// 2. Add PWA logic to actions
const pwaActions = `
        installPWA: async () => {
            const promptEvent = App.state.deferredPrompt;
            if (!promptEvent) return;
            promptEvent.prompt();
            const { outcome } = await promptEvent.userChoice;
            console.log('User choice:', outcome);
            App.state.deferredPrompt = null;
            // Hide all install buttons
            document.querySelectorAll('.install-pwa-btn').forEach(btn => btn.classList.add('hidden'));
        },`;
code = code.replace('actions: {', 'actions: {' + pwaActions);

// 3. Update Dashboard view to include install button placeholder
const dashboardInstallBtn = `
                    <button id="pwa-install-dash" class="install-pwa-btn hidden mt-8 w-full py-6 bg-blue-50 text-blue-600 font-black rounded-[32px] border border-blue-100 flex items-center justify-center gap-4 transition-all active:scale-95 text-[11px] uppercase tracking-widest" onclick="App.actions.installPWA()">📲 App auf Gerät installieren</button>
                </div>`;
code = code.replace('</div>\n            `;\n        },', dashboardInstallBtn + '\n        },');

// 4. Update Admin view to include sidebar install button
const adminSidebarInstallBtn = `
                        <button id="pwa-install-side" class="install-pwa-btn hidden mb-4 py-4 bg-white/10 rounded-[28px] font-black text-[10px] uppercase font-sans tracking-widest transition-all hover:bg-white/20 flex items-center justify-center gap-2" onclick="App.actions.installPWA()">📲 INSTALLIEREN</button>
                        <button`;
code = code.replace(/<button\s*class="mt-auto py-5 bg-white\/10/, adminSidebarInstallBtn + ' class="mt-2 py-5 bg-white/10');

// 5. Global listener for beforeinstallprompt
const globalPwaListener = `
// PWA Installation
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    App.state.deferredPrompt = e;
    console.log('PWA Prompt deferred');
    // Reveal buttons
    setTimeout(() => {
        document.querySelectorAll('.install-pwa-btn').forEach(btn => btn.classList.remove('hidden'));
    }, 1000);
});
`;
if (!code.includes('beforeinstallprompt')) {
    code += globalPwaListener;
}

fs.writeFileSync(filePath, code);
console.log('PWA installation logic injected successfully');
