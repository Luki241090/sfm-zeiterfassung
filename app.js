/**
 * SFM Zeiterfassung - Final Branding Build
 * Custom Logo Integration & Professional PDF Engine
 */

const App = {
    state: {
        currentUser: null,
        currentView: 'login',
        adminSubView: 'monitoring',
        activeScan: { category: null, locId: null, locName: null, logId: null, isCheckout: false },
        activeSession: null,
        reportsData: [],
        filteredReports: [],
        locationsData: [],
        activeLogs: [],
        map: null,
        deferredPrompt: null
    },

    init: async () => {
        // Service Worker registration
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(() => console.log('SFM ServiceWorker registered')).catch(e => console.error('SW Error', e));
        }

        if (!Config.useMockData && typeof SupabaseDB !== 'undefined') {
            const hasInit = SupabaseDB.init();
            if(!hasInit) {
                App.renderView('login'); // Safe fallback if no config
                return;
            }

            try {
                const session = await SupabaseDB.auth.getSession();
                if (session && session.user) {
                    const p = await SupabaseDB.auth.getProfile(session.user.id);
                    App.state.currentUser = {
                        id: session.user.id,
                        full_name: p?.full_name || p?.name || session.user.email,
                        role: p?.role || 'worker',
                        email: session.user.email
                    };
                    App.state.currentUser.name = App.state.currentUser.full_name;
                    App.userRole = App.state.currentUser.role;
                    sessionStorage.setItem('sfm_user', JSON.stringify(App.state.currentUser));
                    
                    await App.actions.loadLocations();
                    await App.actions.syncActiveSession();
                    const isDesktop = window.innerWidth >= 1024;
                    if ((App.state.currentUser.role === 'admin' || App.state.currentUser.role === 'chef') && isDesktop) {
                        App.renderView('admin');
                    } else {
                        App.renderView('dashboard');
                    }
                    App.actions.checkWorkerWarning();
                    return;
                }
            } catch(e) {
                console.warn("Auto-login error", e);
            }
        }

        const savedUser = sessionStorage.getItem('sfm_user');
        if (savedUser) {
            try {
                App.state.currentUser = JSON.parse(savedUser);
                const p = await SupabaseDB.auth.getProfile(App.state.currentUser.id);
                App.state.currentUser.full_name = p?.full_name || p?.name || App.state.currentUser.email || App.state.currentUser.full_name;
                App.state.currentUser.role = p?.role || App.state.currentUser.role;
                App.userRole = App.state.currentUser.role;
                sessionStorage.setItem('sfm_user', JSON.stringify(App.state.currentUser));
                await App.actions.loadLocations();
                await App.actions.syncActiveSession();
                const isDesktop = window.innerWidth >= 1024;
                if ((App.state.currentUser.role === 'admin' || App.state.currentUser.role === 'chef') && isDesktop) {
                    App.renderView('admin');
                } else {
                    App.renderView('dashboard');
                }
                App.actions.checkWorkerWarning();
            } catch(e) {
                sessionStorage.removeItem('sfm_user');
                App.renderView('login');
            }
        } else {
            App.renderView('login');
        }
    },

    // --- MAIN ROUTING ---
    renderView: (viewName, params = {}) => {
        App.state.currentView = viewName;
        const container = document.getElementById('view-container');
        if (!container) return;
        
        container.innerHTML = '';
        App.ui.updateStatusBar();

        switch (viewName) {
            case 'login': App.views.login(container); break;
            case 'dashboard': App.views.dashboard(container); break;
            case 'admin': App.views.admin(container); break;
            case 'scanner': App.views.scanner(container, params); break;
        }
    },

    // --- VIEWS ---
    views: {
        login: (container) => {
            if (document.getElementById('app')) document.getElementById('app').classList.remove('wider');
            container.innerHTML = `
                <div class="login-wrapper w-full min-h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-8 bg-slate-100 italic" style="min-height: 100vh;">
                    <div class="login-card w-full max-w-sm p-10 bg-white rounded-[40px] sm:rounded-[64px] shadow-premium animate-in zoom-in-95 flex flex-col items-center justify-center">
                        <div class="text-center mb-10 italic w-full">
                             <img src="/logo.png" alt="SFM Logo" class="mx-auto mb-8 transition-all object-contain max-w-[200px]">
                             <h1 class="text-primary text-5xl sm:text-6xl font-black italic tracking-tighter mb-2 tracking-[-0.08em] uppercase">Control Cloud</h1>
                             <p class="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em] px-2 italic uppercase">Zeiterfassung Service</p>
                        </div>
                        <div class="space-y-6 w-full flex flex-col items-center">
                           <input type="email" id="email-input" class="w-[90%] sm:w-full px-7 py-5 bg-slate-50 font-bold border-none rounded-[12px]" placeholder="LOGIN EMAIL">
                           <input type="password" id="password-input" class="w-[90%] sm:w-full px-7 py-5 bg-slate-50 font-bold border-none rounded-[12px]" placeholder="PASSWORD">
                           <div class="w-[90%] sm:w-full flex items-center justify-center gap-3 mt-2 mb-2">
                               <input type="checkbox" id="keep-logged-in" checked class="w-5 h-5 accent-primary cursor-pointer rounded">
                               <label for="keep-logged-in" class="text-[11px] font-black text-slate-500 uppercase tracking-widest cursor-pointer">Angemeldet bleiben</label>
                           </div>
                           <button class="w-[90%] sm:w-full bg-primary h-16 rounded-[12px] text-white font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95" onclick="App.actions.login()">ANMELDEN</button>
                        </div>
                    </div>
                </div>
            `;
        },

        dashboard: (container) => {
            if (document.getElementById('app')) document.getElementById('app').classList.remove('wider');
            const user = App.state.currentUser;
            if (!user) return App.renderView('login');

            container.innerHTML = `
                <div class="max-w-xl mx-auto p-6 sm:p-12 w-full animate-in slide-in-from-bottom-10 h-full flex flex-col justify-center min-h-[100dvh]">
                    <div class="flex justify-between items-center mb-10 px-2 sm:px-4">
                        <div class="italic text-left">
                            <p class="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.4em] mb-1 italic">Willkommen zurück</p>
                            <h2 class="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter italic">Hallo ${user.full_name || user.email}</h2>
                        </div>
                        <button class="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full sm:rounded-[32px] flex items-center justify-center text-lg sm:text-xl hover:bg-red-50 hover:text-red-500 transition-all font-bold shadow-premium border border-white" onclick="App.actions.logout()">✕</button>
                    </div>

                    <div class="grid grid-cols-2 gap-4 sm:gap-8 w-full">
                        ${App.ui.menuTile('🧹', 'REINIGUNG', 'unterhalt')}
                        ${App.ui.menuTile('✨', 'SONDER', 'sonder')}
                        ${App.ui.menuTile('❄️', 'WINTER', 'winter')}
                        ${App.ui.menuTile('📋', 'KONTROLLE', 'leitung')}
                    </div>

                    <div id="pwa-install-container" class="mt-8 flex flex-col gap-4 mb-[100px]">
                        <button id="pwa-install-main" class="install-pwa-btn hidden w-full py-6 bg-primary/10 text-primary font-black rounded-[28px] border-2 border-dashed border-primary/20 flex items-center justify-center gap-3 transition-all active:scale-95 text-[11px] tracking-widest uppercase" onclick="App.actions.installPWA()">
                            📲 APP JETZT INSTALLIEREN
                        </button>
                    </div>
                </div>
                
                ${(user.role === 'admin' || user.role === 'chef') ? `
                    <div class="fixed bottom-0 left-0 right-0 p-4 sm:p-8 bg-gradient-to-t from-slate-100 via-slate-100/90 to-transparent pb-6 sm:pb-10 z-50 pointer-events-none">
                        <div class="max-w-xl mx-auto">
                            <button class="w-full py-6 bg-black text-white font-black rounded-[30px] shadow-2xl flex items-center justify-center gap-4 hover:scale-[1.02] transition-all uppercase tracking-[0.3em] text-[10px] pointer-events-auto" onclick="App.renderView('admin')">
                                🔒 ZUM ADMIN DASHBOARD
                            </button>
                        </div>
                    </div>
                ` : ''}
            `;
            // Check if PWA prompt exists
            if (App.state.deferredPrompt) {
                document.querySelectorAll('.install-pwa-btn').forEach(btn => btn.classList.remove('hidden'));
            }
        },

        scanner: (container, params = {}) => {
            if (document.getElementById('app')) document.getElementById('app').classList.remove('wider');
            App.state.activeScan.category = params.category || 'DIENST';
            App.state.activeScan.isCheckout = !!params.isCheckout;
            
            if (!window.isSecureContext && location.hostname !== 'localhost') {
                container.innerHTML = `<div class="w-full h-screen bg-slate-900 text-white p-12 flex flex-col justify-center gap-8 text-center"><h1 class="text-8xl">🔒</h1><h2 class="text-4xl font-black italic tracking-tighter uppercase leading-tight">Verschlüsselung nötig</h2><p class="text-slate-400 font-bold leading-relaxed px-4">Kamera ist nur über HTTPS verfügbar.</p><button class="py-6 bg-white/10 rounded-3xl font-black uppercase text-xs" onclick="App.renderView('dashboard')">Zurück</button></div>`;
                return;
            }

            container.innerHTML = `
                <div id="scanner-ui" class="w-full h-screen bg-slate-900 flex flex-col items-center justify-center p-8">
                    <div id="reader" class="w-full max-w-sm aspect-square rounded-[80px] overflow-hidden shadow-2xl bg-black border-[12px] border-white/5 mb-14 animate-in zoom-in-95"></div>

                    <div id="scan-feedback" class="w-full max-sm hidden animate-in zoom-in-95 scale-90 sm:scale-100">
                         <div id="status-card" class="bg-white p-12 rounded-[64px] shadow-premium text-center flex flex-col gap-6">
                             <div class="text-7xl">📍</div>
                             <h3 id="found-loc-name" class="text-3xl font-black tracking-tighter text-slate-800 italic uppercase italic">OBJ</h3>
                             <p class="text-slate-300 font-black uppercase text-[10px] tracking-widest italic">${App.state.activeScan.category.toUpperCase()}</p>
                             <div id="action-btn-container" class="mt-4">
                                ${params.isCheckout ? 
                                    `<button id="checkout-btn" class="w-full bg-red-500 text-white font-black h-20 rounded-[32px] text-xs shadow-2xl uppercase tracking-[0.2em] transition-all active:scale-95" onclick="App.actions.confirmCheckOut()">JETZT BEENDEN</button>` :
                                    `<button id="checkin-btn" class="w-full bg-primary text-white font-black h-20 rounded-[32px] text-xs shadow-2xl uppercase tracking-[0.2em] transition-all active:scale-95" onclick="App.actions.confirmCheckIn()">JETZT EINCHECKEN</button>`
                                }
                             </div>
                         </div>
                    </div>

                    <button class="mt-8 text-white/30 font-black text-[11px] uppercase tracking-widest underline underline-offset-8" onclick="App.renderView('dashboard')">Abbrechen</button>
                </div>
            `;

            const h = new Html5Qrcode("reader");
            h.start({ facingMode: "environment" }, { fps: 20, qrbox: 280 }, App.actions.onScanSuccess)
                .then(() => App.state.qrScanner = h)
                .catch(e => { console.error(e); App.toast("Kamera blockiert."); });
        },

        admin: (container) => {
            if (document.getElementById('app')) document.getElementById('app').classList.add('wider');
            container.innerHTML = `
                <div class="flex h-screen w-full overflow-hidden bg-slate-50 text-left no-print scale-95 sm:scale-100 origin-top-left">
                    <aside class="w-84 bg-primary text-white flex flex-col p-12 shrink-0 shadow-2xl z-50">
                        <div class="mb-14 italic font-black text-left">
                             <img src="/logo.png" id="sidebar-logo" alt="SFM Logo" style="max-width: 150px; margin-bottom: 20px;" class="grayscale opacity-50 transition-all hover:grayscale-0 hover:opacity-100">
                             <h1 class="text-6xl tracking-tighter italic">SFM</h1>
                             <p class="text-[9px] opacity-20 uppercase tracking-[0.5em] px-1 italic">Facility Cloud Master</p>
                        </div>
                        <nav class="flex-1 space-y-4">
                            ${App.ui.sidebarItem('📍', 'Monitoring (Live)', 'monitoring')}
                            ${App.ui.sidebarItem('📊', 'Auswertungen', 'reports')}
                            ${App.ui.sidebarItem('👥', 'Personalstamm', 'employees')}
                            ${App.ui.sidebarItem('🏷️', 'Objekt-Katalog', 'locations')}
                        </nav>
                        
                        <button id="pwa-install-side" class="install-pwa-btn hidden mb-4 py-4 bg-white/10 rounded-[28px] font-black text-[10px] uppercase font-sans tracking-widest transition-all hover:bg-white/20 flex items-center justify-center gap-2" onclick="App.actions.installPWA()">📲 INSTALLIEREN</button>
                        <button class="mt-2 py-5 bg-white/10 rounded-[28px] font-black text-[10px] uppercase font-sans tracking-widest transition-all hover:bg-white/20" onclick="App.renderView('dashboard')">ZURÜCK ZUR ZEITERFASSUNG</button>
                    </aside>
                    <section id="admin-content" class="flex-1 overflow-y-auto p-16 bg-white/50 backdrop-blur-xl"></section>
                </div>
            `;
            App.views.renderAdminSubView(App.state.adminSubView);
        },

        renderAdminSubView: (v) => {
            const content = document.getElementById('admin-content');
            if (!content) return;
            App.state.adminSubView = v;
            document.querySelectorAll('.sidebar-item').forEach(el => el.classList.toggle('bg-white/10', el.dataset.view === v));
            switch (v) {
                case 'monitoring': App.views.adminMonitoring(content); break;
                case 'reports': App.views.adminReports(content); break;
                case 'locations': App.views.adminLocations(content); break;
                case 'employees': App.views.adminEmployees(content); break;
            }
        },

        adminMonitoring: async (content) => {
            content.innerHTML = `
                <div class="max-w-6xl mx-auto animate-in fade-in duration-500 italic monitoring-container">
                    <div class="monitoring-desktop-grid">
                        <div class="px-4 italic monitoring-header mb-8">
                            <h2 class="text-6xl font-black tracking-tighter text-slate-900 mb-2 italic italic">Monitoring</h2>
                            <p class="text-slate-400 font-bold uppercase text-[10px] tracking-widest underline decoration-primary/20 italic tracking-[0.3em]">LIVE-ÜBERSICHT WIEN HUB</p>
                        </div>
                        <div id="monitoring-map" class="h-[600px] w-full bg-white rounded-[80px] shadow-premium border-[15px] border-white z-0 overflow-hidden relative"></div>
                        <div class="bg-white rounded-[70px] shadow-premium p-12 border border-white active-workers-scroll flex-1">
                            <h3 class="p-6 text-[10px] font-black text-slate-200 uppercase tracking-[0.4em] italic mb-6">Mitarbeiter im Einsatz</h3>
                            <div id="active-workers-list" class="space-y-6"></div>
                        </div>
                    </div>
                </div>
            `;
            App.actions.loadMonitoringData();
        },

        adminReports: async (content) => {
            content.innerHTML = `
                <div class="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 italic">
                    <div class="flex justify-between items-end px-4">
                        <div>
                            <h2 class="text-6xl font-black tracking-tighter text-slate-900 mb-2 italic uppercase">Auswertungen</h2>
                            <p class="text-slate-400 font-bold uppercase text-[10px] tracking-widest underline decoration-primary/20 italic tracking-[0.3em]">PROFESSIONELLE PDF REPORTS</p>
                        </div>
                        <button class="bg-primary text-white px-10 py-5 rounded-[32px] font-black text-[11px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center gap-3" onclick="App.actions.exportReportsPDF()">📄 ALS PDF DRUCKEN</button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 px-4 text-left">
                        <div class="bg-white p-8 rounded-[40px] shadow-premium border border-white flex flex-col gap-4">
                            <label class="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-4 italic italic uppercase">Mitarbeiter</label>
                            <input type="text" id="report-search-name" class="w-full p-5 bg-slate-50 rounded-3xl font-bold border-none placeholder-slate-200 shadow-inner" placeholder="Suchen..." oninput="App.actions.filterReports()">
                        </div>
                        <div class="bg-white p-8 rounded-[40px] shadow-premium border border-white flex flex-col gap-4">
                            <label class="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-4 italic italic uppercase">Objekt / Location</label>
                            <input type="text" id="report-search-loc" class="w-full p-5 bg-slate-50 rounded-3xl font-bold border-none placeholder-slate-200 shadow-inner" placeholder="Objekt suchen..." oninput="App.actions.filterReports()">
                        </div>
                        <div class="bg-white p-8 rounded-[40px] shadow-premium border border-white flex flex-col gap-4">
                            <label class="text-[9px] font-black text-slate-300 uppercase tracking-widest ml-4 italic italic uppercase">Berichtsmonat</label>
                            <select id="report-month" class="w-full p-5 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" onchange="App.actions.filterReports()">
                                <option value="">Alle Monatswerte</option>
                                <option value="0">Januar</option><option value="1">Februar</option><option value="2">März</option><option value="3">April</option><option value="4">Mai</option><option value="5">Juni</option><option value="6">Juli</option><option value="7">August</option><option value="8">September</option><option value="9">Oktober</option><option value="10">November</option><option value="11">Dezember</option>
                            </select>
                        </div>
                    </div>

                    <div id="reports-table-container" class="bg-white rounded-[70px] shadow-premium overflow-hidden p-12 border border-white min-h-[400px]">...</div>
                </div>
            `;
            try {
                // Ensure profile is loaded (redundant safety check)
                if (!App.state.currentUser || !App.state.currentUser.role) {
                    const session = await SupabaseDB.auth.getSession();
                    if (session?.user) {
                        const p = await SupabaseDB.auth.getProfile(session.user.id);
                        App.state.currentUser = { 
                            id: session.user.id, 
                            role: p?.role || 'worker',
                            full_name: p?.full_name || p?.name || session.user.email
                        };
                    }
                }
                
                App.toast("🔄 Synchronisiere...");
                App.state.reportsData = await SupabaseDB.time_logs.getAllForAdmin() || [];
                App.actions.filterReports();
            } catch (err) { 
                console.error("Sync error:", err);
                App.toast("Sync Fehler: Datenbank nicht erreichbar"); 
            }
        },

        adminLocations: async (content) => {
            content.innerHTML = `<div class="max-w-6xl mx-auto space-y-12 animate-in slide-in-from-right-10 duration-500 italic"><div class="px-4"><h2 class="text-6xl font-black tracking-tighter text-slate-900 mb-2 italic italic uppercase">Objekt-Portfolio</h2><p class="text-slate-400 font-bold uppercase text-[10px] tracking-widest px-1 italic">FACILITY DATENBANK</p></div><div class="grid grid-cols-1 lg:grid-cols-2 gap-12 text-left"><div class="bg-white p-12 rounded-[56px] shadow-premium border border-slate-50 flex flex-col gap-8 text-left"><h3 class="text-xs font-black text-primary uppercase tracking-widest italic tracking-[0.3em]">Setup</h3><div class="space-y-4 text-left font-bold"><input id="loc-customer-num" class="w-full p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Kundennummer"><input id="loc-name" class="w-full p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Name des Objekts"><input id="loc-address" class="w-full p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Genaue Adresse" onblur="App.actions.geocodeAddress()"><input id="loc-floor" class="w-full p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Etage / Einheit"><input id="loc-contact" class="w-full p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Kunden-Ansprechpartner"><div class="flex gap-4"><input id="loc-lat" class="w-1/2 p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Breite (Lat)"><input id="loc-lng" class="w-1/2 p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Länge (Lng)"></div></div><button id="qr-save-btn" class="mt-8 py-7 bg-primary text-white font-black rounded-[36px] shadow-2xl tracking-widest text-[11px] uppercase active:scale-95 transition-all flex items-center justify-center gap-4" onclick="App.actions.saveLocation()">DATENSATZ SPEICHERN</button></div><div id="qr-result" class="bg-white p-12 rounded-[56px] shadow-premium flex flex-col items-center justify-center min-h-[450px]"></div></div><div class="bg-white rounded-[70px] shadow-premium overflow-hidden p-12 border border-white mt-12"><table class="w-full text-left font-bold border-separate border-spacing-y-4"><thead class="text-slate-200 uppercase text-[9px] tracking-[0.4em] italic text-left"><tr><th class="p-6">Bezeichnung</th><th class="p-6">Lage / Adresse</th><th class="p-6 text-center">Aktionen</th></tr></thead><tbody id="locations-list"></tbody></table></div></div>`;
            App.actions.loadLocations();
        },

        adminEmployees: async (c) => {
            c.innerHTML = `
                <div class="p-8 flex justify-between items-center italic mb-4">
                    <h2 class="text-6xl font-black tracking-tighter italic uppercase">Personalstamm</h2>
                    <button class="bg-primary px-10 py-6 rounded-[32px] text-white font-black uppercase text-[11px] tracking-widest shadow-2xl transition-all active:scale-95" onclick="App.actions.openEditEmployee()">+ NEU ANLEGEN</button>
                </div>
                <div class="bg-white rounded-[64px] shadow-premium overflow-hidden p-12 mt-8 border border-white">
                    <table class="w-full text-left font-bold border-separate border-spacing-y-4">
                        <thead class="text-slate-200 uppercase text-[10px] tracking-[0.4em] italic text-left">
                            <tr>
                                <th class="p-6">Echter Name</th>
                                <th class="p-6">Account-E-Mail</th>
                                <th class="p-6 text-center">Rolle</th>
                                <th class="p-6 text-right">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody id="member-list"></tbody>
                    </table>
                </div>`;
            App.actions.loadEmployees();
        }
    },

    // --- UI ELEMENTS ---
    ui: {
        menuTile: (emoji, label, cat) => `<div class="aspect-square bg-white border border-slate-100 rounded-[80px] p-10 flex flex-col justify-center items-center gap-6 shadow-premium hover:shadow-2xl hover:scale-[1.05] transition-all cursor-pointer group" onclick="App.renderView('scanner', {category: '${cat}', isCheckout: false})"><div class="text-8xl group-hover:scale-110 transition-transform duration-700 select-none">${emoji}</div><h3 class="font-black text-[12px] uppercase tracking-[0.4em] text-slate-200 group-hover:text-primary transition-colors italic">${label}</h3></div>`,
        sidebarItem: (icon, label, view) => `<div data-view="${view}" class="sidebar-item p-6 rounded-[38px] flex items-center gap-7 cursor-pointer hover:bg-white/5 transition-all group lg:mx-2" onclick="App.views.renderAdminSubView('${view}')"><span class="text-4xl group-hover:scale-110 transition-all duration-500">${icon}</span><span class="font-bold text-[13px] tracking-tight opacity-40 group-hover:opacity-100 italic uppercase">${label}</span></div>`,
        updateStatusBar: () => {
             const bar = document.getElementById('persistent-status'); const app = document.getElementById('app'); const session = App.state.activeSession;
             if (!session) { bar.classList.add('hidden'); app.classList.remove('pt-20'); return; }
             const t = new Date(session.startTime).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
             bar.classList.remove('hidden'); app.classList.add('pt-20');
             bar.innerHTML = `<div class="bg-slate-900 text-white p-5 flex items-center justify-between shadow-premium px-10 border-b border-white/5 no-print"><div class="flex items-center gap-4 text-[10px] font-black italic tracking-[0.2em] uppercase"><span class="text-primary text-xl animate-pulse">📡</span><span>LIVE-DIENST: <span class="bg-primary px-4 py-1.5 rounded-full text-white">${session.name}</span> <span class="text-slate-600 mx-3">|</span> START: ${t}</span></div><button class="bg-red-500 text-white px-8 py-3.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95" onclick="App.renderView('scanner', {isCheckout: true})">BEENDEN</button></div>`;
        }
    },

    // --- LOGIC ACTIONS ---
    actions: {
        installPWA: async () => {
            const promptEvent = App.state.deferredPrompt;
            if (!promptEvent) return;
            promptEvent.prompt();
            const { outcome } = await promptEvent.userChoice;
            console.log('User choice:', outcome);
            App.state.deferredPrompt = null;
            // Hide all install buttons
            document.querySelectorAll('.install-pwa-btn').forEach(btn => btn.classList.add('hidden'));
        },
        geocodeAddress: async () => {
            const addr = document.getElementById('loc-address').value.trim();
            if (addr.length < 5) return;
            try {
                const ep = "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(addr);
                const r = await fetch(ep);
                const d = await r.json();
                if (d && d.length > 0) {
                    document.getElementById('loc-lat').value = parseFloat(d[0].lat).toFixed(6);
                    document.getElementById('loc-lng').value = parseFloat(d[0].lon).toFixed(6);
                    App.toast("📍 Koordinaten gefunden!");
                }
            } catch(e) { console.error("GEO ERR", e); }
        },
        login: async () => {
             const email = document.getElementById('email-input').value.trim();
             const pass = document.getElementById('password-input').value;
             try {
                const res = await SupabaseDB.auth.login(email, pass);
                if (!res.user) throw new Error("Kein User vom Server retourniert.");
                
                let p = null;
                try {
                    p = await SupabaseDB.auth.getProfile(res.user.id);
                } catch(profileErr) {
                    console.warn("Profilabfrage fehlgeschlagen:", profileErr);
                }
                
                App.state.currentUser = {
                    id: res.user.id,
                    name: (p && p.name) || (p && p.full_name) || email,
                    full_name: (p && p.full_name) || (p && p.name) || email,
                    role: (p && p.role) || 'worker',
                    email: email
                };
                
                App.userRole = App.state.currentUser.role;
                sessionStorage.setItem('sfm_user', JSON.stringify(App.state.currentUser));
                
                await App.actions.syncActiveSession();
                const isDesktop = window.innerWidth >= 1024;
                if ((App.userRole === 'admin' || App.userRole === 'chef') && isDesktop) {
                    App.renderView('admin');
                } else {
                    App.renderView('dashboard');
                }
                App.actions.checkWorkerWarning();
             } catch(e) { 
                 console.error("LOGIN FEHLER:", e);
                 App.toast("Zugangsdaten nicht korrekt."); 
             }
        },
        
        logout: async () => { await SupabaseDB.auth.logout(); sessionStorage.removeItem('sfm_user'); App.state.activeSession = null; App.renderView('login'); },

        syncActiveSession: async () => {
             if (!App.state.currentUser) return;
             try {
                const active = await SupabaseDB.time_logs.getActive(App.state.currentUser.id);
                if (active) {
                    const diffHours = (new Date() - new Date(active.start_time)) / 3600000;
                    App.state.activeSession = { id: active.id, name: active.employee_name || '?', locationId: active.location_id, startTime: active.start_time, hours: diffHours };
                } else { App.state.activeSession = null; }
             } catch(e) {}
        },

        checkWorkerWarning: () => {
             const s = App.state.activeSession;
             if (s && s.hours > 10) {
                 const m = document.getElementById('modal-container'); m.classList.remove('hidden');
                 m.innerHTML = `<div class="bg-white p-16 rounded-[70px] w-full max-w-sm text-center flex flex-col items-center gap-10 shadow-3xl"><div class="text-8xl animate-bounce">🚨</div><h2 class="text-3xl font-black italic tracking-tighter text-red-500 uppercase leading-tight tracking-[-0.05em]">Sicherheitscheck</h2><p class="text-slate-400 font-bold leading-relaxed px-4 text-xs font-black italic">Du bist bereits seit ${Math.floor(s.hours)}h im Dienst. Bitte checke aus, falls du fertig bist!</p><button class="w-full py-8 bg-black text-white rounded-[32px] font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-all" onclick="App.renderView('scanner', {isCheckout: true}); document.getElementById('modal-container').classList.add('hidden')">ZUM SCANNER</button><button class="text-slate-300 font-bold uppercase text-[9px] tracking-[0.4em] mt-2 underline" onclick="document.getElementById('modal-container').classList.add('hidden')">SPÄTER</button></div>`;
             }
        },

        onScanSuccess: (t) => {
             const [p, id, n] = t.split('|');
             if (p !== 'SFM') return App.toast("⚠️ KEIN SFM-CODE!");
             if (App.state.activeScan.isCheckout) {
                 if (id !== App.state.activeSession.locationId) return App.toast("📍 FALSCHES OBJEKT!");
                 App.toast("✅ BESTÄTIGT!");
             }
             App.state.activeScan.locId = id; App.state.activeScan.locName = n;
             if (App.state.qrScanner) App.state.qrScanner.stop().catch(e => {});
             document.getElementById('reader').classList.add('hidden');
             document.getElementById('scan-feedback').classList.remove('hidden');
             document.getElementById('found-loc-name').textContent = n;
        },

        confirmCheckIn: async () => {
             try {
                const u = App.state.currentUser; const s = App.state.activeScan;
                let userNotes = null;
                if (s.category === 'sonder') {
                    userNotes = window.prompt('Bitte Objektnamen/Notiz eingeben (Sonderreinigung)');
                    if (!userNotes || userNotes.trim() === '') {
                        App.toast("⚠️ Abbruch: Notiz ist Pflicht für Sonderreinigung!");
                        return;
                    }
                } else if (s.category === 'unterhalt') {
                    userNotes = 'Unterhaltsreinigung';
                }
                const log = await SupabaseDB.time_logs.checkIn({ worker_id: u.id, location_id: s.locId, category: s.category, notes: userNotes });
                App.state.activeSession = { id: log.id, name: s.locName, locationId: s.locId, startTime: log.start_time, hours: 0 };
                App.toast(`✅ EINGELOGGT: ${s.locName}`);
                App.renderView('dashboard');
             } catch (err) { App.toast("Fehler"); }
        },

        confirmCheckOut: async () => {
            const s = App.state.activeSession; if (!s) return;
            try {
                await SupabaseDB.time_logs.checkOut(s.id);
                document.getElementById('status-card').innerHTML = `<div class="text-center p-8"><div class="text-8xl mb-12 animate-bounce">🎬</div><h4 class="text-3xl font-black italic mb-10 italic uppercase font-sans">Dienst beendet</h4><button class="w-full bg-primary text-white py-7 rounded-3xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all" onclick="App.renderView('dashboard')">ZURÜCK HUB</button></div>`;
                App.state.activeSession = null;
            } catch (err) { App.toast("Error"); }
        },

        loadMonitoringData: async () => {
             try {
                const locations = await SupabaseDB.locations.getAll();
                const liveData = await SupabaseDB.time_logs.getLiveMonitoring();
                const container = document.getElementById('monitoring-map'); if (!container) return; container.innerHTML = "";
                const map = L.map('monitoring-map', { zoomControl: false }).setView([48.2082, 16.3738], 12);
                L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png').addTo(map);

                locations.forEach(loc => {
                    if (loc.coords_lat && loc.coords_lng) {
                        const activeEntry = liveData.find(l => l.location_id === loc.id);
                        const isActive = !!activeEntry;
                        
                        // Marker Styling
                        const iconClass = isActive ? "marker-active animate-pulse" : "marker-idle";
                        const iconColor = isActive ? "bg-success" : "bg-slate-300";
                        const iconHtml = `<div class="w-10 h-10 rounded-full border-4 border-white shadow-xl ${iconColor} ${iconClass}"></div>`;
                        const pin = L.divIcon({ className: '', html: iconHtml, iconSize: [40, 40] });
                        
                        // Popup Inhalt
                        const statusTag = isActive 
                            ? `<div class="bg-success/10 text-success p-4 rounded-3xl text-sm font-black uppercase italic shadow-sm border border-success/20">🟢 BESETZT: ${activeEntry.worker_name || activeEntry.full_name || 'Mitarbeiter'}</div>` 
                            : `<span class="italic text-slate-300 text-[10px] uppercase font-black opacity-50">⚪ UNBESETZT</span>`;

                        const popupHtml = `
                            <div class="p-5 text-left italic min-w-[200px]">
                                <h4 class="font-black italic text-xl tracking-tighter uppercase text-primary mb-1">${loc.name}</h4>
                                <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-6 italic">${loc.address}</p>
                                ${statusTag}
                            </div>
                        `;

                        L.marker([loc.coords_lat, loc.coords_lng], { icon: pin }).addTo(map).bindPopup(popupHtml);
                    }
                });

                // Liste rechts befüllen
                document.getElementById('active-workers-list').innerHTML = liveData.map(log => `
                     <div class="bg-white p-10 rounded-[48px] border border-slate-50 flex items-center justify-between group shadow-premium transition-all hover:border-primary/20">
                        <div class="flex items-center gap-7">
                            <div class="w-16 h-16 bg-primary/10 text-primary rounded-[32px] flex items-center justify-center text-3xl font-black italic shadow-inner">${(log.worker_name || log.full_name || 'P')[0]}</div>
                            <div class="text-left">
                                <h4 class="text-2xl font-black italic tracking-tighter text-slate-900 uppercase italic opacity-80">${log.worker_name || log.full_name || 'Mitarbeiter'}</h4>
                                <p class="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] italic">${log.location_name || 'Objekt'}</p>
                            </div>
                        </div>
                        <div class="text-right">
                             <div class="flex flex-col items-end gap-1">
                                <span class="bg-success px-5 py-1.5 rounded-full text-[8px] font-black text-white uppercase tracking-widest animate-pulse shadow-success/40 shadow-lg">Live</span>
                                <p class="text-[11px] font-bold text-slate-400 mt-2 italic">Seit: ${new Date(log.start_time).toLocaleTimeString('de-AT', {hour:'2-digit', minute:'2-digit'})}</p>
                                <button class="mt-4 text-[9px] bg-red-50 text-red-500 px-6 py-2.5 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all w-full text-center hover:bg-red-500 hover:text-white shadow-sm" onclick="App.actions.remoteCheckOut('${log.id}')">STOPP</button>
                             </div>
                        </div>
                     </div>
                `).join('') || `<div class="p-16 text-center italic text-slate-200 uppercase tracking-widest font-black opacity-20 italic">Derzeit keine aktiven Einsätze</div>`;
             } catch(e) { console.error("Monitoring Error:", e); }
        },

        remoteCheckOut: async (logId) => {
             if(!confirm("Einsatz wirklich sofort beenden?")) return;
             try {
                 App.toast("🛑 Beende Einsatz...");
                 await SupabaseDB.time_logs.checkOut(logId);
                 App.toast("✅ Remote-Checkout erfolgreich.");
                 if(typeof App.actions.loadMonitoringData === 'function') {
                     App.actions.loadMonitoringData();
                 }
             } catch(e) {
                 App.toast("❌ Fehler: " + e.message);
             }
        },

        // --- FINAL REPRTING LOGIC ---
        renderReportsTable: (data) => {
            const container = document.getElementById('reports-table-container');
            if (data.length === 0) { container.innerHTML = `<div class="p-20 text-center italic text-slate-200 uppercase tracking-widest font-black opacity-20">Keine Datensatze gefunden</div>`; return; }
            
            const formatDate = (dateStr) => {
                if (!dateStr) return '-';
                const d = new Date(dateStr);
                return d.toLocaleString('de-AT', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            };

            let totalHours = 0;
            const rows = data.map(log => {
                const start = new Date(log.start_time); 
                const end = log.end_time ? new Date(log.end_time) : null;
                
                // Nutze duration_hours aus der View, falls vorhanden, sonst berechne live
                let hrs = log.duration_hours;
                if (hrs === undefined || hrs === null || (hrs === 0 && !log.end_time)) {
                    let diffMs = (end ? end.getTime() : Date.now()) - start.getTime();
                    hrs = Math.max(0, diffMs / 3600000);
                }
                
                totalHours += hrs; 
                const h = Math.floor(hrs); 
                const m = Math.round((hrs - h) * 60);

                // EXAKTE LOGIK WIE VOM USER GEWÜNSCHT
                const displayName = log.full_name || log.employee_name || log.email || 'Kein Name';
                return `
                <tr class="bg-white hover:bg-slate-50 transition-all border-b border-white-50">
                    <td class="p-7 text-left"><span class="text-2xl font-black italic tracking-tighter text-slate-800 italic uppercase">${displayName}</span></td>
                    <td class="p-7 text-left text-slate-300 font-black italic tracking-tight uppercase">${log.location_name || '-'}</td>
                    <td class="p-7 text-left text-slate-500 font-medium italic text-xs">${log.notes || '-'}</td>
                    <td class="p-7 text-slate-600 font-bold text-xs">
                        <div class="flex flex-col gap-1">
                            <span>${formatDate(log.start_time)}</span>
                            <span class="${!log.end_time ? 'text-primary animate-pulse' : 'text-slate-400'}">${log.end_time ? formatDate(log.end_time) : 'AKTIV...'}</span>
                        </div>
                    </td>
                    <td class="p-7 text-center font-black italic text-slate-800 text-3xl italic">${h}h ${m}m</td>
                    <td class="p-7 text-right">
                        <button class="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold p-3 rounded-2xl transition-all active:scale-95 shadow-sm text-[10px] uppercase" onclick="App.actions.editTimeLog('${log.id}')">✏️ Edit</button>
                    </td>
                </tr>`;
            }).join('');
            container.innerHTML = `<table class="w-full text-left font-bold border-separate border-spacing-y-4"><thead class="text-slate-200 uppercase text-[10px] tracking-[0.4em] italic text-left"><tr><th class="p-7">Mitarbeiter</th><th class="p-7">Objekt</th><th class="p-7">Notiz/Typ</th><th class="p-7">Zeitraum (Von/Bis)</th><th class="p-7 text-center">Netto</th><th class="p-7 text-right">Aktion</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="bg-primary/5 rounded-[48px]"><td colspan="5" class="p-10 text-right text-slate-300 font-black uppercase tracking-[0.3em] italic">Gesamtstunden:</td><td class="p-10 text-center text-5xl font-black text-primary italic tracking-tighter">${totalHours.toFixed(2)} h</td></tr></tfoot></table>`;
        },

        editTimeLog: async (logId) => {
             const log = App.state.reportsData.find(l => l.id === logId);
             if(!log) return App.toast("Datensatz nicht gefunden!");
             
             const startObj = new Date(log.start_time);
             const tzOffset = (startObj.getTimezoneOffset() * 60000);
             const sDate = (new Date(startObj - tzOffset)).toISOString().slice(0,16); 
             
             let eDate = '';
             if (log.end_time) {
                 const endObj = new Date(log.end_time);
                 const tzOffsetE = (endObj.getTimezoneOffset() * 60000);
                 eDate = (new Date(endObj - tzOffsetE)).toISOString().slice(0,16);
             }
             
             const m = document.getElementById('modal-container'); 
             m.classList.remove('hidden');
             m.innerHTML = `
                 <div class="bg-white p-12 sm:p-14 rounded-[70px] w-full max-w-sm text-center flex flex-col items-center gap-6 shadow-3xl animate-in zoom-in-95 duration-200">
                     <span class="text-6xl p-6 bg-primary/5 rounded-full mb-1">⏱️</span>
                     <h2 class="text-3xl font-black italic text-slate-900 uppercase tracking-tighter">Zeit Editor</h2>
                     <div class="w-full text-left space-y-4">
                         <div>
                             <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 italic">Startzeit</label>
                             <input type="datetime-local" id="edit-start" class="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none shadow-inner" value="${sDate}">
                         </div>
                         <div class="pt-2">
                             <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 italic">Endzeit</label>
                             <input type="datetime-local" id="edit-end" class="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none shadow-inner" value="${eDate}">
                             <p class="px-2 pt-2 text-[9px] text-slate-300 italic">Leer lassen, wenn die Schicht noch läuft.</p>
                         </div>
                     </div>
                     <div class="flex gap-4 w-full mt-2">
                         <button class="flex-1 py-6 bg-slate-100 rounded-[28px] text-slate-400 font-black uppercase text-[10px] active:scale-95 transition-all" onclick="document.getElementById('modal-container').classList.add('hidden')">ABBRECHEN</button>
                         <button class="flex-1 py-6 bg-primary text-white rounded-[28px] font-black uppercase text-[10px] shadow-2xl active:scale-95 transition-all" onclick="App.actions.saveTimeLog('${log.id}')">SPEICHERN</button>
                     </div>
                 </div>
             `;
        },

        saveTimeLog: async (logId) => {
             const sVal = document.getElementById('edit-start').value;
             let eVal = document.getElementById('edit-end').value;
             if (!sVal) return App.toast("Startzeit fehlt!");
             try {
                App.toast("⚙️ Speichere Zeiten...");
                const updates = { start_time: new Date(sVal).toISOString(), end_time: eVal ? new Date(eVal).toISOString() : null };
                await SupabaseDB.time_logs.update(logId, updates);
                App.toast("✅ Zeit aktualisiert!");
                document.getElementById('modal-container').classList.add('hidden');
                App.state.reportsData = await SupabaseDB.time_logs.getAllForAdmin();
                App.actions.filterReports();
             } catch(e) {
                App.toast("❌ Fehler beim Speichern.");
             }
        },

        filterReports: () => {
            const qName = document.getElementById('report-search-name').value.toLowerCase();
            const qLoc = document.getElementById('report-search-loc').value.toLowerCase();
            const m = document.getElementById('report-month').value;
            App.state.filteredReports = App.state.reportsData.filter(log => {
                const name = (log.employee_name || '').toLowerCase();
                const loc = (log.location_name || '').toLowerCase();
                const d = new Date(log.start_time);
                return name.includes(qName) && loc.includes(qLoc) && (m === "" || d.getMonth().toString() === m);
            });
            App.actions.renderReportsTable(App.state.filteredReports);
        },

        // --- PDF ENGINE (FINAL BRANDING) ---
        exportReportsPDF: () => {
             const data = App.state.filteredReports; if (!data.length) return App.toast("Keine Daten.");
             
             const locSearch = document.getElementById('report-search-loc').value;
             document.getElementById('p-report-location').textContent = locSearch ? locSearch.toUpperCase() : "ALLE AKTIVEN OBJEKTE";
             
             const contact = App.state.locationsData.find(l => l.name.toLowerCase() === locSearch.toLowerCase());
             document.getElementById('p-report-contact').textContent = contact ? contact.contact_person : "Schäffer Facility Management GmbH";
             
             const monthSelect = document.getElementById('report-month');
             const monthText = monthSelect.options[monthSelect.selectedIndex].text;
             document.getElementById('p-report-period').textContent = `${monthText} / ${new Date().getFullYear()}`;
             
             let total = 0;
             const rows = data.map(l => {
                 const s = new Date(l.start_time); const e = l.end_time ? new Date(l.end_time) : null;
                 // EXAKTE LOGIK WIE VOM USER GEWÜNSCHT
                 const displayName = l.full_name || l.employee_name || l.email || 'Kein Name';
                 const h = l.duration_hours || (e ? (e.getTime()-s.getTime())/3600000 : (Date.now()-s.getTime())/3600000); 
                 total += h;
                 return `<tr><td>${displayName}</td><td>${l.location_name || '-'}</td><td>${l.notes || '-'}</td><td>${s.toLocaleDateString('de-AT')}</td><td>${s.toLocaleTimeString('de-AT', {hour:'2-digit', minute:'2-digit'})} - ${e ? e.toLocaleTimeString('de-AT', {hour:'2-digit', minute:'2-digit'}) : 'AKTIV'}</td><td class="font-bold">${h.toFixed(2)} h</td></tr>`;
             });

             document.getElementById('p-report-table-container').innerHTML = `<table><thead><tr><th width="20%">Mitarbeiter</th><th width="20%">Objekt</th><th width="15%">Notiz/Typ</th><th width="15%">Datum</th><th width="20%">Zeitraum</th><th width="10%">Stunden</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
             document.getElementById('p-report-total-box').textContent = `GESAMT STUNDEN: ${total.toFixed(2)} h`;
             
             document.body.classList.add('print-mode-report');
             window.print();
             setTimeout(() => {
                 document.body.classList.remove('print-mode-report');
             }, 1000);

             App.toast("✅ EXPORT GESTARTET");
        },

        // --- DATA FETCH ---
        loadLocations: async () => {
            try {
                const list = await SupabaseDB.locations.getAll(); App.state.locationsData = list || [];
                const role = App.state.currentUser?.role || 'worker';
                const isAdmin = role === 'admin' || role === 'chef';
                
                document.getElementById('locations-list').innerHTML = list.map(loc => `
                    <tr class="bg-white hover:bg-slate-50 transition-all border-b border-slate-50">
                        <td class="p-7 text-left">
                            <div class="flex flex-col">
                                <span class="text-2xl font-black italic tracking-tighter text-slate-800 uppercase italic">${loc.name}</span>
                                <span class="text-[9px] text-slate-300 font-bold uppercase tracking-widest italic tracking-[0.2em]">${loc.customer_number || '-'}</span>
                            </div>
                        </td>
                        <td class="p-7 text-slate-500 font-medium italic">${loc.address}</td>
                        <td class="p-7 text-right align-middle space-x-2">
                            <button class="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold p-3 rounded-2xl transition-all active:scale-95 shadow-sm text-[10px] uppercase" onclick="App.actions.previewQR('${loc.id}', '${loc.name}', '${loc.address}')">🖨️ PRINTER</button>
                            ${isAdmin ? `<button class="bg-red-50 hover:bg-red-500 hover:text-white text-red-500 font-bold p-3 rounded-2xl transition-all active:scale-95 shadow-sm text-[10px] uppercase" onclick="App.actions.deleteLocation('${loc.id}', '${loc.name.replace(/'/g, "\\'")}')">🗑️ Löschen</button>` : ''}
                        </td>
                    </tr>
                `).join('');
            } catch (err) {}
        },

        deleteLocation: async (id, name) => {
             const role = App.state.currentUser?.role;
             if(role !== 'admin' && role !== 'chef') {
                 return App.toast("❌ Keine Berechtigung!");
             }
             
             if(!confirm(`Möchtest du das Objekt [${name}] wirklich unwiderruflich löschen? Alle zugehörigen QR-Codes werden damit ungültig.`)) {
                 return;
             }
             
             try {
                 App.toast("⚙️ Objekt wird gelöscht...");
                 await SupabaseDB.locations.delete(id);
                 App.toast("✅ Objekt erfolgreich gelöscht.");
                 App.actions.loadLocations();
             } catch(e) {
                 console.error(e);
                 App.toast("❌ Fehler beim Löschen des Objekts.");
             }
        },
        saveLocation: async () => {
             const input = { customer_number: document.getElementById('loc-customer-num').value.trim(), name: document.getElementById('loc-name').value.trim(), address: document.getElementById('loc-address').value.trim(), floor: document.getElementById('loc-floor').value.trim(), contact_person: document.getElementById('loc-contact').value.trim(), coords_lat: parseFloat(document.getElementById('loc-lat').value) || null, coords_lng: parseFloat(document.getElementById('loc-lng').value) || null };
             if (!input.name || !input.address) return App.toast("⚠️ Daten unvollständig!");
             try { const l = await SupabaseDB.locations.create(input); App.toast("✅ Gespeichert!"); App.actions.loadLocations(); App.actions.previewQR(l.id, l.name, l.address); } catch (err) { App.toast("Fehler"); }
        },
        previewQR: async (id, name, address) => {
             const r = document.getElementById('qr-result'); 
             r.innerHTML = `<canvas id="qr-preview" class="p-6 bg-white shadow-premium rounded-[48px]" style="max-width: 100%; height: auto;"></canvas><button class="mt-8 bg-black text-white px-10 py-5 rounded-full text-[11px] font-black uppercase shadow-xl active:scale-95 transition-all w-full flex items-center justify-center gap-2" onclick="App.actions.printQR('${id}', '${name}', '${address}')"><span>🖨️</span> QR-SCHILD DRUCKEN</button>`;
             
             const canvas = document.getElementById('qr-preview');
             try {
                 await QRCode.toCanvas(canvas, `SFM|${id}|${name}`, { 
                     width: 800, 
                     margin: 4,
                     errorCorrectionLevel: 'H'
                 });
                 
                 const ctx = canvas.getContext('2d');
                 const img = new Image();
                 img.src = '/logo.png';
                 img.onload = () => {
                     const logoSize = canvas.width * 0.22;
                     const x = (canvas.width - logoSize) / 2;
                     const y = (canvas.height - logoSize) / 2;
                     ctx.fillStyle = '#ffffff';
                     ctx.fillRect(x - 16, y - 16, logoSize + 32, logoSize + 32);
                     
                     let dW = logoSize; let dH = logoSize;
                     if (img.width && img.height) {
                         const ratio = img.width / img.height;
                         if (ratio > 1) dH = dW / ratio; else dW = dH * ratio;
                     }
                     const dx = x + (logoSize - dW)/2;
                     const dy = y + (logoSize - dH)/2;
                     ctx.drawImage(img, dx, dy, dW, dH);
                 };
             } catch(err) { console.error(err); }
        },

        printQR: (id, name, address) => {
             document.getElementById('p-qr-location').textContent = name || "OBJEKT";
             document.getElementById('p-qr-address').textContent = address || "";
             
             const canvas = document.getElementById('qr-preview');
             const qrImg = document.getElementById('p-qr-image');
             
             qrImg.src = canvas.toDataURL('image/png', 1.0);
             
             document.body.classList.add('print-mode-qr');
             document.body.classList.remove('print-mode-report');
             
             const executePrint = () => {
                 window.print();
                 cleanUpPrint();
             };
             
             const cleanUpPrint = () => {
                 setTimeout(() => {
                     document.body.classList.remove('print-mode-qr');
                 }, 1000);
             };
             
             setTimeout(executePrint, 500);
        },
        loadEmployees: async () => {
             const mList = document.getElementById('member-list');
             try { 
                 const list = await SupabaseDB.profiles.getAll();
                 App.state.employeesData = list || [];
                 mList.innerHTML = list.map(u => `
                     <tr class="bg-white hover:bg-slate-50 transition-all border-b border-slate-50">
                         <td class="p-7 text-left align-middle">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black">${u.full_name?.[0] || 'M'}</div>
                                <span class="text-xl font-black italic tracking-tighter text-slate-800 uppercase">${u.full_name}</span>
                            </div>
                         </td>
                         <td class="p-7 text-left align-middle text-slate-400 font-medium">${u.email}</td>
                         <td class="p-7 text-center align-middle">
                             <span class="${u.role === 'admin' || u.role === 'chef' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'} px-5 py-2 rounded-full text-[9px] uppercase font-black tracking-widest border border-transparent">
                                 ${u.role}
                             </span>
                         </td>
                         <td class="p-7 text-right align-middle space-x-2">
                             <button class="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold p-3 rounded-2xl transition-all active:scale-95 shadow-sm text-[10px] uppercase" onclick="App.actions.openEditEmployee('${u.id}')">✏️ Edit</button>
                             <button class="bg-red-50 hover:bg-red-500 hover:text-white text-red-500 font-bold p-3 rounded-2xl transition-all active:scale-95 shadow-sm text-[10px] uppercase" onclick="App.actions.confirmDeleteEmployee('${u.id}')">🗑️ Löschen</button>
                         </td>
                     </tr>
                 `).join('') || `<tr><td colspan="4" class="p-10 text-slate-300 italic text-center uppercase font-black">Kein Personal vorhanden.</td></tr>`; 
             } catch(e) { 
                 mList.innerHTML = `<tr><td colspan="4" class="p-10 text-red-400 italic text-center uppercase font-black">Ladefehler.</td></tr>`; 
             }
        },

        openEditEmployee: (userId = null) => {
             const isEdit = !!userId;
             const user = isEdit ? App.state.employeesData.find(u => u.id === userId) : null;
             
             const m = document.getElementById('modal-container'); 
             m.classList.remove('hidden');
             
             m.innerHTML = `
                 <div class="bg-white p-12 sm:p-14 rounded-[70px] w-full max-w-md text-center flex flex-col items-center gap-6 shadow-3xl animate-in zoom-in-95 duration-200">
                     <div class="text-6xl shadow-premium p-6 bg-primary/5 rounded-full mb-1">${isEdit ? '📝' : '👤'}</div>
                     <h2 class="text-4xl font-black italic tracking-tighter text-slate-900 uppercase">
                         ${isEdit ? 'Profil Editieren' : 'Neues Profil'}
                     </h2>
                     <div class="w-full space-y-4 text-left">
                         <div>
                             <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 italic">Name (Vor-/Nachname)</label>
                             <input id="emp-name" class="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none shadow-inner" placeholder="Echter Name" value="${user ? user.full_name : ''}">
                         </div>
                         <div>
                             <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 italic">Account E-Mail</label>
                             <input id="emp-email" type="email" class="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none shadow-inner" placeholder="name@domain.at" value="${user ? user.email : ''}" ${isEdit ? 'disabled class="opacity-50"' : ''}>
                         </div>
                         <div>
                             <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 italic">Rolle (Rechte)</label>
                             <select id="emp-role" class="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none shadow-inner">
                                 <option value="worker" ${user && (user.role === 'worker' || user.role === 'mitarbeiter') ? 'selected' : ''}>Mitarbeiter (nur Scannen)</option>
                                 <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>Admin (Voller Zugriff)</option>
                             </select>
                         </div>
                         <div>
                             <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 italic">${isEdit ? 'Passwort überschreiben' : 'Initiales Passwort'}</label>
                             <input id="emp-pwd" type="password" class="w-full p-5 bg-slate-50 rounded-2xl font-bold border-none shadow-inner" placeholder="${isEdit ? 'Leer lassen wenn gleich...' : 'Passwort setzen'}">
                         </div>
                     </div>
                     <div class="flex gap-4 w-full mt-2">
                         <button class="flex-1 py-6 bg-slate-100 rounded-[28px] text-slate-400 font-black uppercase text-[10px] active:scale-95 transition-all" onclick="document.getElementById('modal-container').classList.add('hidden')">ABBRECHEN</button>
                         <button class="flex-1 py-6 bg-primary text-white rounded-[28px] font-black uppercase text-[10px] shadow-2xl active:scale-95 transition-all" onclick="App.actions.saveEmployee('${userId || ''}')">${isEdit ? 'SPEICHERN' : 'ANLEGEN'}</button>
                     </div>
                 </div>
             `;
        },

        saveEmployee: async (userId) => {
             const name = document.getElementById('emp-name').value.trim();
             const email = document.getElementById('emp-email').value.trim();
             const role = document.getElementById('emp-role').value;
             let password = document.getElementById('emp-pwd').value;
             
             if (!name || (!userId && !email)) return App.toast("Name & E-Mail benötigt!");
             
             try { 
                 App.toast("⚙️ Bitte warten...");
                 const mContainer = document.getElementById('modal-container');
                 
                 if (userId) { 
                     const updates = { name: name, role: role };
                     if (password) updates.password = password; 
                     await SupabaseDB.profiles.update(userId, updates);
                     App.toast("✅ Aktualisiert!");
                 } else { 
                     if (!password) password = "Sfm12345!"; 
                     const { user } = await SupabaseDB.auth.signUp(email, password, name, role); 
                     if(user) {
                         try {
                              await SupabaseDB.profiles.create({ id: user.id, name: name, role: role, email: email }); 
                         } catch (e) {
                              await SupabaseDB.profiles.update(user.id, { name: name, role: role, email: email });
                         }
                     }
                     App.toast("✅ Account angelegt!"); 
                 }
                 
                 mContainer.classList.add('hidden'); 
                 App.actions.loadEmployees(); 
             } catch(x) { 
                 App.toast("❌ Fehler (Service-Role Key fehlt?)"); 
             }
        },

        confirmDeleteEmployee: (userId) => {
             const user = App.state.employeesData.find(u => u.id === userId);
             if(!user) return;
             
             const m = document.getElementById('modal-container'); 
             m.classList.remove('hidden');
             m.innerHTML = `
                 <div class="bg-white p-14 rounded-[70px] w-full max-w-sm text-center flex flex-col items-center gap-8 shadow-3xl animate-in zoom-in-95 border-2 border-red-500/20">
                     <div class="text-7xl p-6 bg-red-500/10 rounded-full animate-pulse text-red-500">🗑️</div>
                     <h2 class="text-3xl font-black italic tracking-tighter text-slate-900 uppercase leading-snug">Personal<br>Löschen?</h2>
                     <p class="text-slate-500 font-bold text-sm px-4">Möchtest du <span class="text-red-500 italic uppercase">${user.full_name}</span> unwiderruflich löschen? Login unmöglich.</p>
                     <div class="flex flex-col gap-4 w-full mt-2">
                         <button class="w-full py-6 bg-red-500 text-white rounded-[28px] font-black uppercase text-[11px] shadow-2xl active:scale-95 transition-all tracking-widest" onclick="App.actions.deleteEmployee('${userId}')">🚨 JA, LÖSCHEN</button>
                         <button class="w-full py-5 bg-transparent text-slate-400 hover:text-slate-700 font-black uppercase text-[10px] transition-all" onclick="document.getElementById('modal-container').classList.add('hidden')">ABBRECHEN</button>
                     </div>
                 </div>
             `;
        },
        
        deleteEmployee: async (userId) => {
             document.getElementById('modal-container').classList.add('hidden');
             App.toast("⚙️ Löschen...");
             try {
                 await SupabaseDB.profiles.delete(userId);
                 App.toast("✅ Mitarbeiter gelöscht!");
                 App.actions.loadEmployees();
             } catch(x) {
                 App.toast("❌ Löschen fehlgeschlagen.");
             }
        },

        installPWA: async () => {
            const prompt = App.state.deferredPrompt;
            if (!prompt) return;
            prompt.prompt();
            const { outcome } = await prompt.userChoice;
            console.log(`User response to install prompt: ${outcome}`);
            App.state.deferredPrompt = null;
            document.querySelectorAll('.install-pwa-btn').forEach(btn => btn.classList.add('hidden'));
        }
    },

    toast: (msg) => {
        const c = document.getElementById('toast-container'); if (!c) return;
        const e = document.createElement('div');
        e.className = "bg-primary text-white px-10 py-6 rounded-full shadow-2xl font-black text-[12px] uppercase tracking-widest animate-in slide-in-from-right flex gap-4 items-center italic border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.3)]";
        e.innerHTML = `<span>⚡</span><span>${msg}</span>`;
        c.appendChild(e); setTimeout(() => e.remove(), 4000);
    }
};

window.addEventListener('load', App.init); window.App = App;

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
