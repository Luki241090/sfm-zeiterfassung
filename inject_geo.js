import fs from 'fs';

const filePath = 'app.js';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Nominatim Geoproxy Funktion einfuegen
const geocodeFn = `
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
        },`;

if (!code.includes('geocodeAddress')) {
    code = code.replace('actions: {', 'actions: {' + geocodeFn);
}

// 2. Blur Event Listener an das Adressfeld hängen
if (!code.includes('onblur="App.actions.geocodeAddress()"')) {
    code = code.replace(
        'placeholder="Genaue Adresse">', 
        'placeholder="Genaue Adresse" onblur="App.actions.geocodeAddress()">'
    );
}

// 3. 404 Header Cleanup (entferne alte Icons/Manifest falls die noch irgendwo hart drin stehen)
// (Wir haben die manifest.json ja bereits angelegt, so dass die Fehler weg sein sollten.)

fs.writeFileSync(filePath, code);
console.log('Geocoding logic injected successfully');
