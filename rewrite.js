const fs = require('fs');

const appContent = fs.readFileSync('app.js', 'utf8');
let newContent = appContent;

// Fix 1: JSON.parse login flow (Init)
newContent = newContent.replace(
    /App\.state\.currentUser = JSON\.parse\(savedUser\);/g,
    const parsed = JSON.parse(savedUser);
                const p = await SupabaseDB.auth.getProfile(parsed.id);
                App.state.currentUser = { id: parsed.id, full_name: p.full_name, role: p.role, email: p.email || parsed.email };
                sessionStorage.setItem('sfm_user', JSON.stringify(App.state.currentUser));
);

// Fix 2: Auth Login flow
newContent = newContent.replace(
    /const res = await SupabaseDB\.auth\.login\(email, pass\);\s+let p = null;\s+try\s+\{\s+p = await SupabaseDB\.auth\.getProfile\(res\.user\.id\);\s+\}\s+catch\(e\)\s+\{\}\s+App\.state\.currentUser = \{ id: res\.user\.id\, full_name: \(p && p\.full_name\) \|\| email\, role: \(p && p\.role\) \|\| 'worker' \};/g,
    const res = await SupabaseDB.auth.login(email, pass);
                const p = await SupabaseDB.auth.getProfile(res.user.id);
                App.state.currentUser = { id: res.user.id, full_name: p.full_name, role: p.role, email };
);

// Fix 3: Routing logic in login and init
newContent = newContent.replace(
    /App\.renderView\('dashboard'\);/g,
    if (App.state.currentUser.role === 'admin' || App.state.currentUser.role === 'chef') {
                    App.renderView('admin');
                } else {
                    App.renderView('scanner');
                }
);

// Fix 4: If any Data. remain
newContent = newContent.replace(/Data\.auth/g, 'SupabaseDB.auth');

// Fix 5: Replace any remaining objects/time_entries
newContent = newContent.replace(/time_entries/g, 'time_logs');
newContent = newContent.replace(/objects/g, 'locations');

fs.writeFileSync('app.js', newContent);
console.log('Successfully rewrote app.js');
