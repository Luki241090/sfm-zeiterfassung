/**
 * SFM Zeiterfassung — Supabase Client
 *
 * Wird nur aktiv wenn Config.useMockData = false.
 * Alle Methoden geben Promises zurück.
 *
 * ─── BENÖTIGTES SQL-SCHEMA (einmalig in Supabase SQL-Editor ausführen) ──────
 *
 * -- 1. Profiltabelle (erweitert auth.users)
 * CREATE TABLE profiles (
 *   id    UUID REFERENCES auth.users(id) PRIMARY KEY,
 *   name  TEXT NOT NULL,
 *   role  TEXT NOT NULL DEFAULT 'mitarbeiter'
 *           CHECK (role IN ('mitarbeiter','chef')),
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- 2. Objekte (Reinigungsstandorte)
 * CREATE TABLE objects (
 *   id         TEXT PRIMARY KEY,           -- z.B. 'W-001'
 *   name       TEXT NOT NULL,
 *   address    TEXT NOT NULL,
 *   coords_lat FLOAT8,
 *   coords_lng FLOAT8,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- 3. Zeiterfassungseinträge
 * CREATE TABLE time_entries (
 *   id          TEXT PRIMARY KEY,
 *   worker_id   UUID REFERENCES auth.users(id),
 *   object_id   TEXT REFERENCES objects(id),
 *   category    TEXT,
 *   start_time  TIMESTAMPTZ NOT NULL,
 *   end_time    TIMESTAMPTZ,
 *   start_lat   FLOAT8,
 *   start_lng   FLOAT8,
 *   end_lat     FLOAT8,
 *   end_lng     FLOAT8,
 *   status      TEXT DEFAULT 'active' CHECK (status IN ('active','completed')),
 *   created_at  TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- 4. RLS aktivieren
 * ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE objects     ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
 *
 * -- Policies
 * CREATE POLICY "Alle können Objekte lesen"
 *   ON objects FOR SELECT TO authenticated USING (true);
 *
 * CREATE POLICY "Nur Chef darf Objekte anlegen"
 *   ON objects FOR INSERT TO authenticated
 *   WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'chef');
 *
 * CREATE POLICY "Mitarbeiter sehen eigene Einträge"
 *   ON time_entries FOR ALL TO authenticated
 *   USING (worker_id = auth.uid());
 *
 * CREATE POLICY "Chef sieht alle Einträge"
 *   ON time_entries FOR SELECT TO authenticated
 *   USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'chef');
 *
 * CREATE POLICY "Eigenes Profil lesen"
 *   ON profiles FOR SELECT TO authenticated USING (id = auth.uid());
 *
 * CREATE POLICY "Chef liest alle Profile"
 *   ON profiles FOR SELECT TO authenticated
 *   USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'chef');
 *
 * -- Auto-Profil bei neuem User
 * CREATE OR REPLACE FUNCTION handle_new_user()
 * RETURNS TRIGGER AS $$
 * BEGIN
 *   INSERT INTO profiles (id, name, role)
 *   VALUES (
 *     NEW.id,
 *     COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
 *     COALESCE(NEW.raw_user_meta_data->>'role', 'mitarbeiter')
 *   );
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql SECURITY DEFINER;
 *
 * CREATE TRIGGER on_auth_user_created
 *   AFTER INSERT ON auth.users
 *   FOR EACH ROW EXECUTE FUNCTION handle_new_user();
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';

let _client = null;

const SupabaseDB = {

    // ── Initialisierung ──────────────────────────────────────────────────────
    init() {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY;

        if (!url || !key) {
            console.error('[Supabase] VITE_SUPABASE_URL oder VITE_SUPABASE_ANON_KEY fehlt in den Environment Variables.');
            _client = null;
            return false;
        }
        
        _client = createClient(url, key);
        console.info('[Supabase] Client erfolgreich mit Vercel-Env initialisiert.');
        return true;
    },

    get client() { return _client; },

    // Interne Prüfung
    _getReadyClient() {
        if (!_client) {
            throw new Error('Supabase-Client nicht initialisiert. Bitte VITE_SUPABASE_URL und VITE_SUPABASE_KEY in der .env prüfen.');
        }
        return _client;
    },

    // ── AUTH ─────────────────────────────────────────────────────────────────
    auth: {
        async login(email, password) {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return data; // { user, session }
        },

        async signUp(email, password, name, role = 'worker') {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: {
                    data: { name, role }
                }
            });
            if (error) throw error;
            return data; // { user, session }
        },

        async logout() {
            const client = SupabaseDB._getReadyClient();
            await client.auth.signOut();
        },

        async getSession() {
            const client = SupabaseDB._getReadyClient();
            const { data: { session } } = await client.auth.getSession();
            return session;
        },

        async getProfile(userId) {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            if (error) throw error;
            return data; // { id, full_name, role }
        },

        // ── 2FA / MFA (TOTP) ──────────────────────────────────────────────
        async getAAL() {
            const { data } = await _client.auth.mfa.getAuthenticatorAssuranceLevel();
            return data; // { currentLevel, nextLevel }
        },

        async listFactors() {
            const { data, error } = await _client.auth.mfa.listFactors();
            if (error) throw error;
            return data?.totp || [];
        },

        async enrollTOTP() {
            const { data, error } = await _client.auth.mfa.enroll({
                factorType: 'totp',
                issuer: 'SFM Zeiterfassung Wien'
            });
            if (error) throw error;
            return {
                factorId: data.id,
                qrSvg: data.totp.qr_code,   // SVG-String direkt anzeigbar
                secret: data.totp.secret,    // Manueller Key
                uri: data.totp.uri
            };
        },

        async challengeTOTP(factorId) {
            const { data, error } = await _client.auth.mfa.challenge({ factorId });
            if (error) throw error;
            return data.id; // challengeId
        },

        async verifyTOTP(factorId, challengeId, code) {
            const { error } = await _client.auth.mfa.verify({ factorId, challengeId, code });
            return !error;
        },

        async unenrollTOTP(factorId) {
            await _client.auth.mfa.unenroll({ factorId });
        }
    },

    // ── OBJEKTE ──────────────────────────────────────────────────────────────
    objects: {
        async getAll() {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client
                .from('objects')
                .select('*')
                .order('name');
            if (error) throw error;
            return data || [];
        },

        async getById(id) {
            const client = SupabaseDB._getReadyClient();
            const { data } = await client
                .from('objects')
                .select('*')
                .eq('id', id)
                .single();
            if (!data) return null;
            // Normalisiert auf App-Format
            return {
                name: data.name,
                address: data.address,
                coords: data.coords_lat ? { lat: data.coords_lat, lng: data.coords_lng } : null
            };
        },

        async create(obj) {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client
                .from('objects')
                .insert({
                    id: obj.id,
                    name: obj.name,
                    address: obj.address,
                    coords_lat: obj.coords?.lat || null,
                    coords_lng: obj.coords?.lng || null
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    // ── PROFILES ─────────────────────────────────────────────────────────────
    profiles: {
        async getAll() {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client
                .from('profiles')
                .select('*')
                .order('full_name');
            if (error) throw error;
            return data || [];
        },

        async create(profile) {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client
                .from('profiles')
                .insert({
                    id: profile.id,
                    full_name: profile.name,
                    role: profile.role || 'worker',
                    email: profile.email
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    // ── LOCATIONS (QR) ────────────────────────────────────────────────────────
    locations: {
        async getAll() {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client
                .from('locations')
                .select('*')
                .order('name');
            if (error) throw error;
            return data || [];
        },

        async create(loc) {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client
                .from('locations')
                .insert({
                    name: loc.name,
                    address: loc.address,
                    floor: loc.floor || '-',
                    contact_person: loc.contact_person || '-',
                    customer_number: loc.customer_number || '-',
                    coords_lat: loc.coords_lat || null,
                    coords_lng: loc.coords_lng || null
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    // ── TIME LOGS (CHECK-IN/OUT) ─────────────────────────────────────────────
    time_logs: {
        async checkIn(log) {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client
                .from('time_logs')
                .insert({
                    worker_id: log.worker_id,
                    location_id: log.location_id,
                    category: log.category,
                    start_time: new Date().toISOString()
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async checkOut(id) {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client
                .from('time_logs')
                .update({ end_time: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async getActive(workerId) {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client
                .from('time_logs')
                .select(`
                    *,
                    locations ( name, coords_lat, coords_lng )
                `)
                .eq('worker_id', workerId)
                .is('end_time', null)
                .maybeSingle();
            if (error) throw error;
            return data;
        },

        async getActiveAll() {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client
                .from('admin_timesheet') // Nutze die View auch für aktive Pins (sofern end_time NULL möglich)
                .select('*')
                .is('end_time', null)
                .order('employee_name', { ascending: true });
            if (!error && data) return data;

            // Fallback falls View Filter nicht geht
            const { data: fb, error: fbe } = await client
                .from('time_logs')
                .select(`
                    *,
                    locations ( name, address, coords_lat, coords_lng ),
                    profiles ( full_name )
                `)
                .is('end_time', null)
                .order('start_time', { ascending: false });
            if (fbe) throw fbe;
            return fb || [];
        },

        async getAll() {
            const client = SupabaseDB._getReadyClient();
            // Versuche von der View admin_timesheet zu laden (optimiert)
            try {
                const { data, error } = await client
                    .from('admin_timesheet')
                    .select('*')
                    .order('employee_name', { ascending: true });
                if (!error && data) return data;
            } catch(e) { console.warn("admin_timesheet view not found, falling back to manual join."); }

            // Fallback: Manueller Join
            const { data, error } = await client
                .from('time_logs')
                .select(`
                    *,
                    locations ( name, address ),
                    profiles ( full_name )
                `)
                .order('start_time', { ascending: false });
            if (error) throw error;
            return data || [];
        }
    },

    // ── SESSIONS / TIME ENTRIES ───────────────────────────────────────────────
    sessions: {
        async getAll() {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client
                .from('time_entries')
                .select(`
                    *,
                    objects  ( name, address ),
                    profiles ( name )
                `)
                .order('start_time', { ascending: false });
            if (error) throw error;
            return (data || []).map(SupabaseDB.sessions._normalize);
        },

        async getAllActive() {
            const client = SupabaseDB._getReadyClient();
            const { data } = await client
                .from('time_entries')
                .select(`
                    *,
                    objects  ( name, address, coords_lat, coords_lng ),
                    profiles ( name )
                `)
                .eq('status', 'active');
            return (data || []).map(SupabaseDB.sessions._normalize);
        },

        async getActive(userId) {
            const client = SupabaseDB._getReadyClient();
            const { data } = await client
                .from('time_entries')
                .select('*')
                .eq('worker_id', userId)
                .eq('status', 'active')
                .single();
            return data ? SupabaseDB.sessions._normalize(data) : null;
        },

        async create(session) {
            const client = SupabaseDB._getReadyClient();
            const { data, error } = await client
                .from('time_entries')
                .insert({
                    id:         session.id,
                    worker_id:  session.userId,
                    object_id:  session.objectId,
                    category:   session.category,
                    start_time: session.startTime,
                    start_lat:  session.startPos?.lat || null,
                    start_lng:  session.startPos?.lng || null,
                    status:     'active'
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async update(id, updates) {
            const client = SupabaseDB._getReadyClient();
            const payload = {};
            if (updates.endTime)  payload.end_time  = updates.endTime;
            if (updates.endPos)   { payload.end_lat = updates.endPos.lat; payload.end_lng = updates.endPos.lng; }
            if (updates.status)   payload.status    = updates.status;

            const { error } = await client
                .from('time_entries')
                .update(payload)
                .eq('id', id);
            if (error) throw error;
        },

        // Konvertiert Supabase-Zeile → App-Format (gleich wie Mock)
        _normalize(row) {
            return {
                id:        row.id,
                userId:    row.worker_id,
                objectId:  row.object_id,
                category:  row.category,
                startTime: row.start_time,
                endTime:   row.end_time || null,
                startPos:  row.start_lat ? { lat: row.start_lat, lng: row.start_lng } : null,
                endPos:    row.end_lat   ? { lat: row.end_lat,   lng: row.end_lng   } : null,
                status:    row.status,
                // Joined fields (nur bei select mit join)
                objectName:    row.objects?.name    || null,
                objectAddress: row.objects?.address || null,
                workerName:    row.profiles?.full_name   || null
            };
        }
    }
};

// Auto-Init sobald Config geladen ist
window.addEventListener('load', () => {
    if (typeof Config !== 'undefined' && !Config.useMockData) {
        SupabaseDB.init();
    }
});

// Globaler Zugriff für app.js und andere Scripte
window.SupabaseDB = SupabaseDB;
