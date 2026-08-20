const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Ensure Mail icon is imported
if (!code.includes('Mail,')) {
    code = code.replace(/import \{ ([^}]+) \} from "lucide-react";/, 'import { $1, Mail } from "lucide-react";');
}

// 1. Signature
code = code.replace(
  /function TodayView\(\{ tasks, toggleTask, deleteTask, updateTask, onTaskClick, notificationPermission, onRequestPermission, setView, aiRecommendation, isAiLoading, getAiRecommendation, weather, weatherLoading, fetchWeather \}: \{ tasks: Task\[\], toggleTask: \(id: string, current: boolean\) => void, deleteTask: \(id: string\) => void, updateTask: \(id: string, updates: Partial<Task>\) => void, onTaskClick: \(task: Task\) => void, notificationPermission: NotificationPermission, onRequestPermission: \(\) => void, setView: \(view: any\) => void, aiRecommendation: string \| null, isAiLoading: boolean, getAiRecommendation: \(\) => void, weather: \{ temp: number, code: number, isDay: number \} \| null, weatherLoading: boolean, fetchWeather: \(\) => void \}\) \{/,
  `function TodayView({ tasks, toggleTask, deleteTask, updateTask, onTaskClick, notificationPermission, onRequestPermission, setView, gmailToken, gmailEmails, isFetchingEmails, handleGmailLogin, weather, weatherLoading, fetchWeather }: { tasks: Task[], toggleTask: (id: string, current: boolean) => void, deleteTask: (id: string) => void, updateTask: (id: string, updates: Partial<Task>) => void, onTaskClick: (task: Task) => void, notificationPermission: NotificationPermission, onRequestPermission: () => void, setView: (view: any) => void, gmailToken: string | null, gmailEmails: any[], isFetchingEmails: boolean, handleGmailLogin: () => void, weather: { temp: number, code: number, isDay: number } | null, weatherLoading: boolean, fetchWeather: () => void }) {`
);

// 2. Render call
code = code.replace(/<TodayView[\s\S]*?\/>/, 
`<TodayView 
              tasks={tasks}
              toggleTask={toggleTask}
              deleteTask={deleteTask}
              updateTask={updateTask}
              onTaskClick={setSelectedTask}
              notificationPermission={notificationPermission}
              onRequestPermission={onRequestPermission}
              setView={setView}
              weather={weather}
              weatherLoading={weatherLoading}
              fetchWeather={fetchWeather}
              gmailToken={gmailToken}
              gmailEmails={gmailEmails}
              isFetchingEmails={isFetchingEmails}
              handleGmailLogin={handleGmailLogin}
            />`);

// 3. Replace Yapay Zeka section with Gmail and add transparent placeholders for the rest
let todayViewContent = code.substring(code.indexOf('function TodayView'));
// We need to replace the content of TodayView

fs.writeFileSync('src/App.tsx', code);
console.log("Replaced");
