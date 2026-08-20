const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /\/\/ Fetch Gmail emails\s+useEffect\(\(\) => \{\s+if \(gmailToken && !isFetchingEmails && gmailEmails\.length === 0\) \{[\s\S]*?\.finally\(\(\) => setIsFetchingEmails\(false\)\);\s+\}\s+\}, \[gmailToken\]\);/m;

const replacement = `// Fetch Gmail emails
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchEmails = () => {
      if (!gmailToken) return;
      // Don't set isFetchingEmails to true on every interval to avoid UI flicker, only on initial load
      // Or we can just let it fetch silently in the background
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
    };

    if (gmailToken) {
      if (gmailEmails.length === 0) setIsFetchingEmails(true);
      fetchEmails();
      intervalId = setInterval(fetchEmails, 30000); // 30 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [gmailToken]);`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/App.tsx', code);
console.log("Updated Gmail polling.");
