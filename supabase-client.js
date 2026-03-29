import { createClient } from '@supabase/supabase-js';

let _client = null;
let _adminClient = null;

const SupabaseDB = {

    // ── Initialisierung ──────────────────────────────────────────────────────
    init() {
        let url = '';
        let key = '';
        let serviceKey = '';
        
        try {
            url = import.meta.env.VITE_SUPABASE_URL;
            key = import.meta.env.VITE_SUPABASE_ANON_KEY;
            serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        } catch(e) {
            console.warn('[Supabase] import.meta.env nicht verfügbar.');
        }

        if (!url || !key) return false;
        
        _client = createClient(url, key);
        
        if (serviceKey) {
            _adminClient = createClient(url, serviceKey, { 
                auth: { autoRefreshToken: false, persistSession: false }
            });
        }
        
        return true;
    },

    get client() { return _client; },

    _getReadyClient() {
        if (!_client) throw new Error('Supabase-Client nicht initialisiert.');
        return _client;
    },

    // ── AUTH ─────────────────────────────────────────────────────────────────
    auth: {
        async login(email, password) {
            const { data, error } = await SupabaseDB._getReadyClient().auth.signInWithPassword({ email, password });
            if (error) throw error;
            return data;
        },

        async signUp(email, password, name, role = 'worker') {
            const { data, error } = await SupabaseDB._getReadyClient().auth.signUp({
                email,
                password,
                options: { data: { name: name, full_name: name, role: role } }
            });
            if (error) throw error;
            return data;
        },

        async logout() {
            await SupabaseDB._getReadyClient().auth.signOut();
        },

        async getSession() {
            const { data: { session } } = await SupabaseDB._getReadyClient().auth.getSession();
            return session;
        },

        async getProfile(userId) {
            // Nutzt maybeSingle() damit kein 500er Error fliegt wenn die Zeile fehlt
            const { data, error } = await SupabaseDB._getReadyClient()
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            if (error) throw error;
            return data; // Wenn kein Profil, gibt es null zuruck
        }
    },

    // ── PROFILES ─────────────────────────────────────────────────────────────
    profiles: {
        async getAll() {
            const { data, error } = await SupabaseDB._getReadyClient()
                .from('profiles')
                .select('*')
                .order('name'); // Wir sortieren nach name, da beide spalten (name & full_name) da sind
            if (error && error.code === '42703') { // Fallback wenn name nicht existiert, aber full_name
                 const fb = await SupabaseDB._getReadyClient().from('profiles').select('*').order('full_name');
                 if(fb.error) throw fb.error;
                 return fb.data || [];
            }
            if (error) throw error;
            return data || [];
        },

        async create(profile) {
            const { data, error } = await SupabaseDB._getReadyClient()
                .from('profiles')
                .insert({
                    id: profile.id,
                    name: profile.name,
                    full_name: profile.name,
                    role: profile.role || 'worker',
                    email: profile.email
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async update(id, updates) {
            const client = SupabaseDB._getReadyClient();
            const payload = {};
            if (updates.name) {
                payload.name = updates.name;
                payload.full_name = updates.name;
            }
            if (updates.email) payload.email = updates.email;
            if (updates.role) payload.role = updates.role;
            
            if (Object.keys(payload).length > 0) {
                const { error } = await client.from('profiles').update(payload).eq('id', id);
                if (error) throw error;
            }

            if (_adminClient && (updates.email || updates.password)) {
                const adminUpdates = {};
                if (updates.email) adminUpdates.email = updates.email;
                if (updates.password) adminUpdates.password = updates.password;
                const { error } = await _adminClient.auth.admin.updateUserById(id, adminUpdates);
                if (error) throw error;
            }
        },

        async delete(id) {
            const client = SupabaseDB._getReadyClient();
            if (_adminClient) {
                await _adminClient.auth.admin.deleteUser(id);
            }
            const { error } = await client.from('profiles').delete().eq('id', id);
            if (error) throw error;
        }
    },

    // ── LOCATIONS ────────────────────────────────────────────────────────────
    locations: {
        async getAll() {
            const { data, error } = await SupabaseDB._getReadyClient()
                .from('locations')
                .select('*')
                .order('name');
            if (error) throw error;
            return data || [];
        },

        async create(loc) {
            const { data, error } = await SupabaseDB._getReadyClient()
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
        },

        async delete(id) {
            const client = SupabaseDB._getReadyClient();
            await client.from('time_logs').delete().eq('location_id', id);
            const { error } = await client.from('locations').delete().eq('id', id);
            if (error) throw error;
        }
    },

    // ── TIME LOGS ────────────────────────────────────────────────────────────
    time_logs: {
        async checkIn(log) {
            const { data, error } = await SupabaseDB._getReadyClient()
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
            const { data, error } = await SupabaseDB._getReadyClient()
                .from('time_logs')
                .update({ end_time: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async update(id, updates) {
            const { data, error } = await SupabaseDB._getReadyClient()
                .from('time_logs')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },

        async getActive(workerId) {
            const { data, error } = await SupabaseDB._getReadyClient()
                .from('time_logs')
                .select('*, locations ( name, coords_lat, coords_lng )')
                .eq('worker_id', workerId)
                .is('end_time', null)
                .maybeSingle();
            if (error) throw error;
            return data;
        },

        async getActiveAll() {
            const { data, error } = await SupabaseDB._getReadyClient()
                .from('admin_timesheet') 
                .select('*')
                .is('end_time', null)
                .order('employee_name', { ascending: true });
            return data || [];
        },

        // Haupt-Abfrage fuer Reports
        async getAllForAdmin() {
            const { data, error } = await SupabaseDB._getReadyClient()
                .from('admin_timesheet')
                .select('*')
                .order('start_time', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        
        async getAll() {
            return await this.getAllForAdmin();
        }
    }
};

window.addEventListener('load', () => {
    if (typeof Config !== 'undefined' && !Config.useMockData) {
        SupabaseDB.init();
    }
});

window.SupabaseDB = SupabaseDB;
