const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add states for gmail
code = code.replace(
  /const \[accessToken, setAccessToken\] = useState<string \| null>\(null\);/,
  `const [accessToken, setAccessToken] = useState<string | null>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [gmailEmails, setGmailEmails] = useState<any[]>([]);
  const [isFetchingEmails, setIsFetchingEmails] = useState(false);`
);

// Add gmail error handler
code = code.replace(
  /const handleGoogleError = \(e: any\) => \{/,
  `const handleGmailError = (e: any) => {
    console.error(e);
    if (e?.message === '401_UNAUTHENTICATED' || e?.status === 401) {
      setGmailToken(null);
      if (user) {
        setDoc(doc(db, 'users', user.uid), { gmailToken: null }, { merge: true });
      }
    }
  };
  const handleGoogleError = (e: any) => {`
);

// Read gmail token from snapshot
code = code.replace(
  /if \(data\.googleCalendarToken && data\.googleCalendarToken !== accessToken\) \{/,
  `if (data.gmailToken && data.gmailToken !== gmailToken) {
           setGmailToken(data.gmailToken);
        }
        if (data.googleCalendarToken && data.googleCalendarToken !== accessToken) {`
);

// Gmail login function
code = code.replace(
  /const handleLogin = async \(\) => \{/,
  `const handleGmailLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGmailToken(credential.accessToken);
        if (auth.currentUser) {
          setDoc(doc(db, 'users', auth.currentUser.uid), { gmailToken: credential.accessToken }, { merge: true });
        }
      }
    } catch (error) {
      console.error("Gmail Login Error:", error);
    }
  };

  const handleLogin = async () => {`
);

// Fetch emails effect
code = code.replace(
  /const toggleTask = async/,
  `// Fetch Gmail emails
  useEffect(() => {
    if (gmailToken && !isFetchingEmails && gmailEmails.length === 0) {
      setIsFetchingEmails(true);
      fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=3', {
        headers: { Authorization: \`Bearer \${gmailToken}\` }
      })
      .then(res => {
        if (!res.ok) {
          if (res.status === 401) throw new Error('401_UNAUTHENTICATED');
          throw new Error('Failed to fetch messages');
        }
        return res.json();
      })
      .then(async data => {
        if (data.messages && data.messages.length > 0) {
          const emailPromises = data.messages.map((m: any) => 
            fetch(\`https://gmail.googleapis.com/gmail/v1/users/me/messages/\${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From\`, {
              headers: { Authorization: \`Bearer \${gmailToken}\` }
            }).then(r => r.json())
          );
          const fullEmails = await Promise.all(emailPromises);
          
          const formattedEmails = fullEmails.map((email: any) => {
            const subjectHeader = email.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'subject');
            const fromHeader = email.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'from');
            return {
              id: email.id,
              snippet: email.snippet,
              subject: subjectHeader ? subjectHeader.value : '(Konu yok)',
              from: fromHeader ? fromHeader.value.split('<')[0].trim() : 'Bilinmeyen'
            };
          });
          setGmailEmails(formattedEmails);
        } else {
          setGmailEmails([]);
        }
      })
      .catch(handleGmailError)
      .finally(() => setIsFetchingEmails(false));
    }
  }, [gmailToken]);

  const toggleTask = async`
);

fs.writeFileSync('src/App.tsx', code);
console.log("App.tsx patched");
