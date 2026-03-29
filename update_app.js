import fs from 'fs';
let code = fs.readFileSync('app.js', 'utf8');

// Ensure App.userRole is set as requested
code = code.replace(
    /App\.state\.currentUser\.role = p\.role;/g,
    `App.state.currentUser.role = p.role;\n                App.userRole = p.role;`
);

fs.writeFileSync('app.js', code);
console.log('Update complete!');
