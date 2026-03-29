import fs from 'fs';

let code = fs.readFileSync('app.js', 'utf8');

// Update Login Logic to give detailed errors if something fails, and handle null profiles gracefully
code = code.replace(
    /login:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?catch\(e\)\s*\{\s*App\.toast\("Zugriff verweigert\."\);\s*\}\s*\}/,
    `login: async () => {
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
                
                if (App.userRole === 'admin' || App.userRole === 'chef') {
                    App.renderView('admin');
                } else {
                    App.renderView('scanner');
                }
                App.actions.checkWorkerWarning();
             } catch(e) { 
                 console.error("LOGIN FEHLER:", e);
                 App.toast("Zugriff verweigert: " + (e.message || "Unbekannter Fehler")); 
             }
        }`
);

// Update init session restore logic to match graceful degradation
code = code.replace(
    /init:\s*async\s*\(\)\s*=>\s*\{[\s\S]*?const savedUser = sessionStorage\.getItem\('sfm_user'\);[\s\S]*?if \(savedUser\)\s*\{[\s\S]*?try\s*\{[\s\S]*?App\.state\.currentUser = JSON\.parse.*?\} else \{\s*App\.renderView\('login'\);\s*\}/,
    `init: async () => {
        if (!Config.useMockData && typeof SupabaseDB !== 'undefined') {
            SupabaseDB.init();
        }

        const savedUser = sessionStorage.getItem('sfm_user');
        if (savedUser) {
            try {
                const parsed = JSON.parse(savedUser);
                let p = null;
                try { p = await SupabaseDB.auth.getProfile(parsed.id); } catch(pe) { console.warn(pe); }
                
                App.state.currentUser = {
                    id: parsed.id,
                    name: (p && p.name) || (p && p.full_name) || parsed.name || parsed.email,
                    full_name: (p && p.full_name) || (p && p.name) || parsed.full_name || parsed.email,
                    role: (p && p.role) || parsed.role || 'worker',
                    email: parsed.email
                };
                
                App.userRole = App.state.currentUser.role;
                sessionStorage.setItem('sfm_user', JSON.stringify(App.state.currentUser));
                
                await App.actions.syncActiveSession();
                
                if (App.userRole === 'admin' || App.userRole === 'chef') {
                    App.renderView('admin');
                } else {
                    App.renderView('scanner');
                }
                App.actions.checkWorkerWarning();
            } catch(e) {
                console.error("Session Wiederherstellung fehlgeschlagen:", e);
                sessionStorage.removeItem('sfm_user');
                App.renderView('login');
            }
        } else {
            App.renderView('login');
        }`
);

fs.writeFileSync('app.js', code);
console.log('Login logic fully rewritten for graceful profile handling.');
