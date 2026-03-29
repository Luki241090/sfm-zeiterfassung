import fs from 'fs';

const filePath = 'app.js';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Desktop Optimization: Add/Remove 'wider' class
// We only want to add it for the admin view to expand it on desktop
code = code.replace('admin: (container) => {', "admin: (container) => {\n            if (document.getElementById('app')) document.getElementById('app').classList.add('wider');");
code = code.replace('login: (container) => {', "login: (container) => {\n            if (document.getElementById('app')) document.getElementById('app').classList.remove('wider');");
code = code.replace('dashboard: (container) => {', "dashboard: (container) => {\n            if (document.getElementById('app')) document.getElementById('app').classList.remove('wider');");
code = code.replace('scanner: (container, params = {}) => {', "scanner: (container, params = {}) => {\n            if (document.getElementById('app')) document.getElementById('app').classList.remove('wider');");

// 2. Ensure loadLocations is called for state population
// This is used for mapping location IDs to names and for the map
code = code.replace('await App.actions.syncActiveSession();', "await App.actions.loadLocations();\n                await App.actions.syncActiveSession();");

fs.writeFileSync(filePath, code);
console.log('App.js updated successfully via ESM script');
