const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

const replacement = `
    match /users/{userId} {
      allow read, write: if isSignedIn() && request.auth.uid == userId;
    }
    
    // Users Collection (Tasks Subcollection)
`;

code = code.replace('// Users Collection (Tasks Subcollection)', replacement);
fs.writeFileSync('firestore.rules', code);
