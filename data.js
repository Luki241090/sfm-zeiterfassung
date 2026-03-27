/**
 * SFM Zeiterfassung — Data Layer
 *
 * Alle Methoden sind async und unterstützen zwei Modi:
 *   Config.useMockData = true  → localStorage (kein Backend nötig)
 *   Config.useMockData = false → Supabase (supabase-client.js muss konfiguriert sein)
 */

const Data = {

    // ── Mock-Stammdaten ───────────────────────────────────────────────────────
    get users() {
        let stored = JSON.parse(localStorage.getItem('sfm_users') || 'null');
        if (!stored) {
            stored = [
                { id: 'u1', name: 'Max Mustermann', role: 'mitarbeiter', email: 'max@sfm.at', password: 'password123', pin: '1234', active: true },
                { id: 'u2', name: 'Chef Admin', role: 'chef', email: 'admin@sfm.at', password: 'admin', pin: '0000', active: true }
            ];
            localStorage.setItem('sfm_users', JSON.stringify(stored));
        }
        return stored;
    },
    saveUsers(usersArray) {
        localStorage.setItem('sfm_users', JSON.stringify(usersArray));
    },

    objects: {
        'W-001': { name: 'Bürokomplex Donau City', address: 'Donau-City-Straße 7, 1220 Wien', coords: { lat: 48.2335, lng: 16.4135 } },
        'W-002': { name: 'Kanzlei am Ring', address: 'Opernring 1, 1010 Wien', coords: { lat: 48.2023, lng: 16.3683 } },
        'W-003': { name: 'Wohnpark Alterlaa', address: 'Anton-Baumgartner-Str. 44, 1230 Wien', coords: { lat: 48.1504, lng: 16.3155 } },
        'W-004': { name: 'MedCenter Nord', address: 'Brünner Straße 131, 1210 Wien', coords: { lat: 48.2755, lng: 16.3985 } },
        'W-005': { name: 'Fitnessstudio West', address: 'Hütteldorfer Str. 130, 1140 Wien', coords: { lat: 48.1985, lng: 16.3015 } },
        'W-006': { name: 'Schule Margareten', address: 'Reinprechtsdorfer Str. 20, 1050 Wien', coords: { lat: 48.1885, lng: 16.3585 } },
        'W-010': { name: 'Palais Favoriten', address: 'Favoritenstraße 15, 1040 Wien', coords: { lat: 48.1925, lng: 16.3715 } }
    },

    // ── Sicherheits-State (immer localStorage, kein Supabase) ────────────────
    getSecurityState: () => JSON.parse(localStorage.getItem('sfm_security') || '{}'),
    saveSecurityState: (state) => localStorage.setItem('sfm_security', JSON.stringify({
        ...Data.getSecurityState(), ...state
    })),
    getResetTokens: () => JSON.parse(localStorage.getItem('sfm_resets') || '{}'),
    saveResetToken: (email, token) => {
        const tokens = Data.getResetTokens();
        tokens[token] = { email, expires: Date.now() + 30 * 60 * 1000 };
        localStorage.setItem('sfm_resets', JSON.stringify(tokens));
    },

    // ── AUTH ─────────────────────────────────────────────────────────────────
    auth: {
        async login(email, password) {
            if (Config.useMockData) {
                const user = Data.users.find(u => u.email === email && u.password === password);
                if (!user) throw new Error('Ungültige E-Mail oder Passwort');
                return { user: { id: user.id }, profile: user };
            }
            if (!SupabaseDB.client) {
                throw new Error('Supabase Verbindung steht nicht. Bitte die .env Datei mit korrekten Keys füllen und Server neu starten.');
            }
            const { user } = await SupabaseDB.auth.login(email, password);
            const profile = await SupabaseDB.auth.getProfile(user.id);
            return { user, profile };
        },

        async logout() {
            if (!Config.useMockData) await SupabaseDB.auth.logout();
            sessionStorage.removeItem('sfm_user');
        },

        // 2FA – Mock (otplib)
        generateSecret: () => otplib.authenticator.generateSecret(),
        getOtpauth: (name, secret) => otplib.authenticator.keyuri(name, 'SFM Zeiterfassung', secret),
        verifyToken: (secret, token) => {
            try { return otplib.authenticator.check(token, secret); }
            catch { return false; }
        },

        // 2FA – Supabase
        async getAAL() { return Config.useMockData ? null : SupabaseDB.auth.getAAL(); },
        async listFactors() { return Config.useMockData ? [] : SupabaseDB.auth.listFactors(); },
        async enrollTOTP() { return SupabaseDB.auth.enrollTOTP(); },
        async challengeTOTP(fId) { return SupabaseDB.auth.challengeTOTP(fId); },
        async verifyTOTP(fId, cId, code) { return SupabaseDB.auth.verifyTOTP(fId, cId, code); }
    },

    // ── OBJEKTE ───────────────────────────────────────────────────────────────
    async getObjects() {
        if (Config.useMockData) return Data.objects;
        const list = await SupabaseDB.objects.getAll();
        // In Map umwandeln für kompatibles Interface
        return Object.fromEntries(list.map(o => [o.id, o]));
    },

    getObjectById(id) {
        // Sync-Shortcut für Mock (bleibt sync damit bestehende Aufrufe nicht brechen)
        if (Config.useMockData) return Data.objects[id] || null;
        // Async-Wrapper für Supabase-Aufrufe via await
        return SupabaseDB.objects.getById(id);
    },

    // ── SESSIONS ──────────────────────────────────────────────────────────────
    async getSessions() {
        if (Config.useMockData) return JSON.parse(localStorage.getItem('sfm_sessions') || '[]');
        return SupabaseDB.sessions.getAll();
    },

    async saveSession(session) {
        if (Config.useMockData) {
            const sessions = JSON.parse(localStorage.getItem('sfm_sessions') || '[]');
            sessions.push(session);
            localStorage.setItem('sfm_sessions', JSON.stringify(sessions));
            return;
        }
        await SupabaseDB.sessions.create(session);
    },

    async updateSession(sessionId, endData) {
        if (Config.useMockData) {
            const sessions = JSON.parse(localStorage.getItem('sfm_sessions') || '[]');
            const i = sessions.findIndex(s => s.id === sessionId);
            if (i !== -1) {
                sessions[i] = { ...sessions[i], ...endData };
                localStorage.setItem('sfm_sessions', JSON.stringify(sessions));
            }
            return;
        }
        await SupabaseDB.sessions.update(sessionId, endData);
    },

    async getActiveSession(userId) {
        if (Config.useMockData) {
            const sessions = JSON.parse(localStorage.getItem('sfm_sessions') || '[]');
            return sessions.find(s => s.userId === userId && !s.endTime) || null;
        }
        return SupabaseDB.sessions.getActive(userId);
    },

    // ── HELPERS ───────────────────────────────────────────────────────────────
    getUserByEmail: (email) => Data.users.find(u => u.email === email),
    getUserByPin: (pin) => Data.users.find(u => u.pin === pin),

    updatePassword(email, newPassword) {
        const users = Data.users;
        const index = users.findIndex(u => u.email === email);
        if (index === -1) return false;
        users[index].password = newPassword;
        Data.saveUsers(users);
        if (users[index].role === 'chef') Data.saveSecurityState({ twoFactorSecret: null });
        return true;
    },

    saveUser(user) {
        const users = Data.users;
        const index = users.findIndex(u => u.id === user.id);
        if (index > -1) {
            users[index] = { ...users[index], ...user };
        } else {
            users.push({ ...user, id: user.id || 'U-' + Date.now(), active: true });
        }
        Data.saveUsers(users);
    }
};

window.Data = Data;
