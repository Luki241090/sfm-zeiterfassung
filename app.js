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
        map: null
    },

    init: async () => {
        if (!Config.useMockData && typeof SupabaseDB !== 'undefined') {
            SupabaseDB.init();
        }

        const savedUser = sessionStorage.getItem('sfm_user');
        if (savedUser) {
            try {
                App.state.currentUser = JSON.parse(savedUser);
                await App.actions.syncActiveSession();
                App.renderView('dashboard');
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
            container.innerHTML = `
                <div class="flex-1 flex items-center justify-center p-8 bg-slate-100 italic">
                    <div class="w-full max-sm p-12 bg-white rounded-[64px] shadow-premium animate-in zoom-in-95">
                        <div class="text-center mb-10 italic">
                             <img src="/logo.png" alt="SFM Logo" class="mx-auto mb-8 grayscale hover:grayscale-0 transition-all opacity-40 h-24 p-2">
                             <h1 class="text-primary text-6xl font-black italic tracking-tighter mb-2 tracking-[-0.08em] uppercase">Control Cloud</h1>
                             <p class="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em] px-2 italic uppercase">Zeiterfassung Service</p>
                        </div>
                        <div class="space-y-6">
                           <input type="email" id="email-input" class="w-full px-7 py-5 bg-slate-50 rounded-[28px] font-bold border-none" placeholder="LOGIN EMAIL">
                           <input type="password" id="password-input" class="w-full px-7 py-5 bg-slate-50 rounded-[28px] font-bold border-none" placeholder="PASSWORD">
                           <button class="w-full bg-primary h-16 rounded-[28px] text-white font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95" onclick="App.actions.login()">ANMELDEN</button>
                        </div>
                    </div>
                </div>
            `;
        },

        dashboard: (container) => {
            const user = App.state.currentUser;
            if (!user) return App.renderView('login');

            container.innerHTML = `
                <div class="max-w-xl mx-auto p-12 w-full animate-in slide-in-from-bottom-10 h-full flex flex-col justify-center">
                    <div class="flex justify-between items-end mb-16 px-4">
                        <div class="italic text-left">
                            <p class="text-slate-400 font-bold text-[10px] uppercase tracking-[0.4em] mb-1 italic">Personal ID Hub</p>
                            <h2 class="text-4xl font-black text-slate-900 tracking-tighter italic">${user.full_name || 'Kollege'}</h2>
                        </div>
                        <button class="w-16 h-16 bg-white rounded-[32px] flex items-center justify-center text-xl hover:bg-red-50 hover:text-red-500 transition-all font-bold shadow-premium border border-white" onclick="App.actions.logout()">✕</button>
                    </div>

                    <div class="grid grid-cols-2 gap-8 w-full">
                        ${App.ui.menuTile('🧹', 'REINIGUNG', 'unterhalt')}
                        ${App.ui.menuTile('✨', 'SONDER', 'sonder')}
                        ${App.ui.menuTile('❄️', 'WINTER', 'winter')}
                        ${App.ui.menuTile('📋', 'KONTROLLE', 'leitung')}
                    </div>

                    ${(user.role === 'admin' || user.role === 'chef') ? `
                        <button class="mt-20 w-full py-7 bg-black text-white font-black rounded-[40px] shadow-2xl flex items-center justify-center gap-4 hover:scale-[1.02] transition-all uppercase tracking-[0.3em] text-[10px]" onclick="App.renderView('admin')">
                            🔒 ADMIN MASTER CONSOLE (SFM)
                        </button>
                    ` : ''}
                </div>
            `;
        },

        scanner: (container, params = {}) => {
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
                        <button class="mt-auto py-5 bg-white/10 rounded-[28px] font-black text-[10px] uppercase font-sans tracking-widest transition-all hover:bg-white/20" onclick="App.renderView('dashboard')">ZURÜCK DAHSBOARD</button>
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
                <div class="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 italic">
                    <div class="px-4 italic">
                        <h2 class="text-6xl font-black tracking-tighter text-slate-900 mb-2 italic italic">Monitoring</h2>
                        <p class="text-slate-400 font-bold uppercase text-[10px] tracking-widest underline decoration-primary/20 italic tracking-[0.3em]">LIVE-ÜBERSICHT WIEN HUB</p>
                    </div>
                    <div id="monitoring-map" class="h-[600px] w-full bg-white rounded-[80px] shadow-premium border-[15px] border-white z-0 overflow-hidden relative"></div>
                    <div class="bg-white rounded-[70px] shadow-premium p-12 border border-white">
                        <h3 class="p-6 text-[10px] font-black text-slate-200 uppercase tracking-[0.4em] italic mb-6">Mitarbeiter im Einsatz</h3>
                        <div id="active-workers-list" class="space-y-6"></div>
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
                App.state.reportsData = await SupabaseDB.time_logs.getAll() || [];
                App.actions.filterReports();
            } catch (err) { App.toast("Sync Fehler"); }
        },

        adminLocations: async (content) => {
            content.innerHTML = `<div class="max-w-6xl mx-auto space-y-12 animate-in slide-in-from-right-10 duration-500 italic"><div class="px-4"><h2 class="text-6xl font-black tracking-tighter text-slate-900 mb-2 italic italic uppercase">Objekt-Portfolio</h2><p class="text-slate-400 font-bold uppercase text-[10px] tracking-widest px-1 italic">FACILITY DATENBANK</p></div><div class="grid grid-cols-1 lg:grid-cols-2 gap-12 text-left"><div class="bg-white p-12 rounded-[56px] shadow-premium border border-slate-50 flex flex-col gap-8 text-left"><h3 class="text-xs font-black text-primary uppercase tracking-widest italic tracking-[0.3em]">Setup</h3><div class="space-y-4 text-left font-bold"><input id="loc-customer-num" class="w-full p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Kundennummer"><input id="loc-name" class="w-full p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Name des Objekts"><input id="loc-address" class="w-full p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Genaue Adresse"><input id="loc-floor" class="w-full p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Etage / Einheit"><input id="loc-contact" class="w-full p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Kunden-Ansprechpartner"><div class="flex gap-4"><input id="loc-lat" class="w-1/2 p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Breite (Lat)"><input id="loc-lng" class="w-1/2 p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Länge (Lng)"></div></div><button id="qr-save-btn" class="mt-8 py-7 bg-primary text-white font-black rounded-[36px] shadow-2xl tracking-widest text-[11px] uppercase active:scale-95 transition-all flex items-center justify-center gap-4" onclick="App.actions.saveLocation()">DATENSATZ SPEICHERN</button></div><div id="qr-result" class="bg-white p-12 rounded-[56px] shadow-premium flex flex-col items-center justify-center min-h-[450px]"></div></div><div class="bg-white rounded-[70px] shadow-premium overflow-hidden p-12 border border-white mt-12"><table class="w-full text-left font-bold border-separate border-spacing-y-4"><thead class="text-slate-200 uppercase text-[9px] tracking-[0.4em] italic text-left"><tr><th class="p-6">Bezeichnung</th><th class="p-6">Lage / Adresse</th><th class="p-6 text-center">QR Print</th></tr></thead><tbody id="locations-list"></tbody></table></div></div>`;
            App.actions.loadLocations();
        },

        adminEmployees: async (c) => {
            c.innerHTML = `<div class="p-8 flex justify-between items-center italic mb-4"><h2 class="text-6xl font-black tracking-tighter italic uppercase italic">Personalstamm</h2><button class="bg-primary px-10 py-6 rounded-[32px] text-white font-black uppercase text-[11px] tracking-widest shadow-2xl transition-all active:scale-95" onclick="App.actions.openAddEmployee()">+ Neu</button></div><div class="bg-white rounded-[64px] shadow-premium overflow-hidden p-12 mt-8 border border-white"><table class="w-full text-left font-bold border-separate border-spacing-y-4"><thead class="text-slate-200 uppercase text-[10px] tracking-[0.4em] italic text-left"><tr><th class="p-6">Echter Name</th><th class="p-6">Account-E-Mail</th><th class="p-6">Account-Rolle</th></tr></thead><tbody id="member-list"></tbody></table></div>`;
            try { const l = await SupabaseDB.profiles.getAll(); document.getElementById('member-list').innerHTML = l.map(u => `<tr class="bg-white hover:bg-slate-50 transition-all border-b border-slate-50"><td class="p-7 text-2xl font-black italic tracking-tighter text-slate-800 italic uppercase">${u.full_name}</td><td class="p-7 text-slate-400 font-medium">${u.email}</td><td class="p-7"><span class="bg-blue-50 text-blue-600 px-6 py-2 rounded-full text-[10px] uppercase font-black tracking-widest">${u.role}</span></td></tr>`).join(''); } catch(e) { document.getElementById('member-list').innerHTML = `<tr><td colspan="3" class="p-10 text-slate-300 italic text-left uppercase font-black">Sync-Fehler.</td></tr>`; }
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
        login: async () => {
             const email = document.getElementById('email-input').value.trim();
             const pass = document.getElementById('password-input').value;
             try {
                const res = await Data.auth.login(email, pass);
                let p = null; try { p = await SupabaseDB.auth.getProfile(res.user.id); } catch(e) {}
                App.state.currentUser = { id: res.user.id, full_name: (p && p.full_name) || email, role: (p && p.role) || 'worker' };
                sessionStorage.setItem('sfm_user', JSON.stringify(App.state.currentUser));
                await App.actions.syncActiveSession();
                App.renderView('dashboard');
                App.actions.checkWorkerWarning();
             } catch(e) { App.toast("Zugriff verweigert."); }
        },
        
        logout: async () => { await Data.auth.logout(); sessionStorage.removeItem('sfm_user'); App.state.activeSession = null; App.renderView('login'); },

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
                const log = await SupabaseDB.time_logs.checkIn({ worker_id: u.id, location_id: s.locId, category: s.category });
                App.state.activeSession = { id: log.id, name: s.locName, locationId: s.locId, startTime: log.start_time, hours: 0 };
                App.toast(`✅ EINGELOGGT: ${s.locName}`); App.renderView('dashboard');
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
                const active = await SupabaseDB.time_logs.getActiveAll();
                const container = document.getElementById('monitoring-map'); if (!container) return; container.innerHTML = "";
                const map = L.map('monitoring-map', { zoomControl: false }).setView([48.2082, 16.3738], 12);
                L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png').addTo(map);

                locations.forEach(loc => {
                    if (loc.coords_lat && loc.coords_lng) {
                        const logsAtLoc = active.filter(l => l.location_id === loc.id);
                        const isActive = logsAtLoc.length > 0;
                        const isWarning = logsAtLoc.some(l => {
                            const hrs = (new Date() - new Date(l.start_time)) / 3600000;
                            return hrs > 10;
                        });
                        const iconClass = isWarning ? "pin-red-blink" : (isActive ? "pin-green" : "pin-idle");
                        const iconHtml = `<div class="w-10 h-10 rounded-full border-4 border-white shadow-xl ${isWarning ? 'bg-alert' : (isActive ? 'bg-success' : 'bg-slate-300')} ${iconClass}"></div>`;
                        const pin = L.divIcon({ className: '', html: iconHtml, iconSize: [40, 40] });
                        const popup = `<div class="p-5 text-left italic"><h4 class="font-black italic text-xl tracking-tighter uppercase text-primary">${loc.name}</h4><p class="text-[9px] text-slate-300 font-bold uppercase tracking-widest mb-4 italic">${loc.address}</p>${isActive ? `<div class="bg-primary p-4 rounded-3xl text-white text-xs font-black uppercase italic shadow-lg">👥 AKTIV: ${logsAtLoc.map(l => l.employee_name || 'Kollege').join(', ')}</div>` : `<span class="italic text-slate-200 text-[10px] uppercase font-black">UNBESETZT</span>`}</div>`;
                        L.marker([loc.coords_lat, loc.coords_lng], { icon: pin }).addTo(map).bindPopup(popup);
                    }
                });

                document.getElementById('active-workers-list').innerHTML = active.map(log => `
                     <div class="bg-slate-50 p-10 rounded-[48px] border border-transparent flex items-center justify-between group shadow-sm transition-all hover:border-primary/20">
                        <div class="flex items-center gap-7">
                            <div class="w-16 h-16 bg-primary/10 text-primary rounded-[32px] flex items-center justify-center text-3xl font-black italic shadow-inner">${(log.employee_name || 'P')[0]}</div>
                            <div class="text-left">
                                <h4 class="text-2xl font-black italic tracking-tighter text-slate-900 uppercase italic opacity-80">${log.employee_name || 'Mitarbeiter'}</h4>
                                <p class="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] italic">${log.location_name || 'Objekt'}</p>
                            </div>
                        </div>
                        <div class="text-right">
                             <div class="flex flex-col items-end gap-1">
                                <span class="bg-success px-5 py-1.5 rounded-full text-[8px] font-black text-white uppercase tracking-widest animate-pulse">Live</span>
                                <p class="text-[11px] font-bold text-slate-400 mt-2 italic">Dienstbeginn: ${new Date(log.start_time).toLocaleTimeString('de-AT', {hour:'2-digit', minute:'2-digit'})}</p>
                             </div>
                        </div>
                     </div>
                `).join('') || `<div class="p-16 text-center italic text-slate-200 uppercase tracking-widest font-black opacity-20 italic">Derzeit keine aktiven Einsatze</div>`;
             } catch(e) { console.error(e); }
        },

        // --- FINAL REPRTING LOGIC ---
        renderReportsTable: (data) => {
            const container = document.getElementById('reports-table-container');
            if (data.length === 0) { container.innerHTML = `<div class="p-20 text-center italic text-slate-200 uppercase tracking-widest font-black opacity-20">Keine Datensatze gefunden</div>`; return; }
            let totalHours = 0;
            const rows = data.map(log => {
                const start = new Date(log.start_time); const end = log.end_time ? new Date(log.end_time) : null;
                let hrs = log.duration_hours || (end ? (end-start)/3600000 : (new Date()-start)/3600000);
                totalHours += hrs; const h = Math.floor(hrs); const m = Math.round((hrs-h)*60);
                return `
                <tr class="bg-white hover:bg-slate-50 transition-all border-b border-slate-50">
                    <td class="p-7 text-left"><span class="text-2xl font-black italic tracking-tighter text-slate-800 italic uppercase">${log.employee_name || 'Personal'}</span></td>
                    <td class="p-7 text-left text-slate-300 font-black italic tracking-tight uppercase">${log.location_name || '-'}</td>
                    <td class="p-7 text-slate-400 font-medium">${start.toLocaleDateString('de-AT')}</td>
                    <td class="p-7 text-slate-800 font-black italic text-sm text-left italic">${start.toLocaleTimeString('de-AT', {hour:'2-digit', minute:'2-digit'})} - ${end ? end.toLocaleTimeString('de-AT', {hour:'2-digit', minute:'2-digit'}) : '<span class="text-primary animate-pulse">AKTIV</span>'}</td>
                    <td class="p-7 text-center font-black italic text-slate-800 text-3xl italic">${h}h ${m}m</td>
                </tr>`;
            }).join('');
            container.innerHTML = `<table class="w-full text-left font-bold border-separate border-spacing-y-4"><thead class="text-slate-200 uppercase text-[10px] tracking-[0.4em] italic text-left"><tr><th class="p-7">Mitarbeiter</th><th class="p-7">Objekt</th><th class="p-7">Datum</th><th class="p-7">Zeitfenster</th><th class="p-7 text-center">Netto</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="bg-primary/5 rounded-[48px]"><td colspan="4" class="p-10 text-right text-slate-300 font-black uppercase tracking-[0.3em] italic">Gefilterte Gesamtstunden:</td><td class="p-10 text-center text-5xl font-black text-primary italic tracking-tighter">${totalHours.toFixed(2)} h</td></tr></tfoot></table>`;
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
             document.getElementById('p-report-contact').textContent = contact ? contact.contact_person : "SFM ZENTRALE / WIEN";
             
             const monthSelect = document.getElementById('report-month');
             const monthText = monthSelect.options[monthSelect.selectedIndex].text;
             document.getElementById('p-report-period').textContent = `${monthText} / ${new Date().getFullYear()}`;
             
             let total = 0;
             const rows = data.map(l => {
                 const s = new Date(l.start_time); const e = l.end_time ? new Date(l.end_time) : null;
                 const h = l.duration_hours || (e ? (e-s)/3600000 : 0); total += h;
                 return `<tr><td>${l.employee_name}</td><td>${l.location_name}</td><td>${s.toLocaleDateString('de-AT')}</td><td>${s.toLocaleTimeString('de-AT', {hour:'2-digit', minute:'2-digit'})} - ${e ? e.toLocaleTimeString('de-AT', {hour:'2-digit', minute:'2-digit'}) : 'AKTIV'}</td><td class="font-bold">${h.toFixed(2)} h</td></tr>`;
             });

             document.getElementById('p-report-table-container').innerHTML = `<table><thead><tr><th width="25%">Mitarbeiter</th><th width="25%">Objekt</th><th width="15%">Datum</th><th width="20%">Zeitraum</th><th width="15%">Stunden</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
             document.getElementById('p-report-total-box').textContent = `GESAMT STUNDEN: ${total.toFixed(2)} h`;
             
             window.print();
             App.toast("✅ EXPORT GESTARTET");
        },

        // --- DATA FETCH ---
        loadLocations: async () => {
            try {
                const list = await SupabaseDB.locations.getAll(); App.state.locationsData = list || [];
                document.getElementById('locations-list').innerHTML = list.map(loc => `<tr class="bg-white hover:bg-slate-50 transition-all border-b border-slate-50"><td class="p-7 text-left"><div class="flex flex-col"><span class="text-2xl font-black italic tracking-tighter text-slate-800 italic uppercase italic">${loc.name}</span><span class="text-[9px] text-slate-300 font-bold uppercase tracking-widest italic tracking-[0.2em]">${loc.customer_number || '-'}</span></div></td><td class="p-7 text-slate-500 font-medium italic">${loc.address}</td><td class="p-7 text-center"><button class="bg-slate-100 p-4 rounded-3xl hover:bg-primary hover:text-white transition-all scale-90 active:scale-75 shadow-sm" onclick="App.actions.previewQR('${loc.id}', '${loc.name}', '${loc.address}')">🖨️ PRINTER</button></td></tr>`).join('');
            } catch (err) {}
        },
        saveLocation: async () => {
             const input = { customer_number: document.getElementById('loc-customer-num').value.trim(), name: document.getElementById('loc-name').value.trim(), address: document.getElementById('loc-address').value.trim(), floor: document.getElementById('loc-floor').value.trim(), contact_person: document.getElementById('loc-contact').value.trim(), coords_lat: parseFloat(document.getElementById('loc-lat').value) || null, coords_lng: parseFloat(document.getElementById('loc-lng').value) || null };
             if (!input.name || !input.address) return App.toast("⚠️ Daten unvollständig!");
             try { const l = await SupabaseDB.locations.create(input); App.toast("✅ Gespeichert!"); App.actions.loadLocations(); App.actions.previewQR(l.id, l.name, l.address); } catch (err) { App.toast("Fehler"); }
        },
        previewQR: (id, name, address) => {
             const r = document.getElementById('qr-result'); r.innerHTML = `<canvas id="qr-preview" class="p-10 bg-white shadow-premium rounded-[48px]"></canvas><button class="mt-8 bg-black text-white px-10 py-5 rounded-full text-[11px] font-black uppercase shadow-xl active:scale-95 transition-all" onclick="window.print()">QR-CODE DRUCKEN</button>`;
             QRCode.toCanvas(document.getElementById('qr-preview'), `SFM|${id}|${name}`, { width: 400 });
        },
        openAddEmployee: () => {
             const m = document.getElementById('modal-container'); m.classList.remove('hidden');
             m.innerHTML = `<div class="bg-white p-16 rounded-[70px] w-full max-w-sm text-center flex flex-col items-center gap-10 shadow-3xl"><div class="text-7xl shadow-premium p-8 bg-primary/5 rounded-full">👤</div><h2 class="text-3xl font-black italic tracking-tighter text-slate-900 uppercase">Personal Setup</h2><div class="w-full space-y-4"><input id="new-name" class="w-full p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="Echter Name (Vor/Nach)"><input id="new-email" class="w-full p-6 bg-slate-50 rounded-3xl font-bold border-none shadow-inner" placeholder="E-Mail Adresse"></div><div class="flex gap-4 w-full"><button class="flex-1 py-7 bg-slate-100 rounded-[32px] text-slate-300 font-black uppercase text-[10px]" onclick="document.getElementById('modal-container').classList.add('hidden')">Cancel</button><button class="flex-1 py-7 bg-primary text-white rounded-[32px] font-black uppercase text-[10px] shadow-2xl active:scale-95 transition-all" onclick="App.actions.saveEmployee()">ANLEGEN</button></div></div>`;
        },
        saveEmployee: async () => {
             try { const n = document.getElementById('new-name').value; const e = document.getElementById('new-email').value; const { user } = await SupabaseDB.auth.signUp(e, 'Sfm12345!', n, 'worker'); await SupabaseDB.profiles.create({ id: user.id, name: n, role: 'worker', email: e }); App.toast("✅ Angelegt!"); document.getElementById('modal-container').classList.add('hidden'); App.views.renderAdminSubView('employees'); } catch(x) { App.toast("Auth Fehler"); }
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
