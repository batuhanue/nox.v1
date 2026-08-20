const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Remove from TodayView
code = code.replace(/<AiChat isOpen=\{isAiChatOpen\} onClose=\{\(\) => setIsAiChatOpen\(false\)\} \/>/g, '');

// Put it back where it belongs (at the end of App component, just before the closing </div> of App)
// The end of App component looks like this:
/*
      </div>
    </div>
  );
}
*/
const replacement = `
        <AiChat isOpen={isAiChatOpen} onClose={() => setIsAiChatOpen(false)} />
      </div>
    </div>
  );
}
`;
code = code.replace(/      <\/div>\n    <\/div>\n  \);\n}/, replacement);

fs.writeFileSync('src/App.tsx', code);
