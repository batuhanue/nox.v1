const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Update TodayView signature
code = code.replace(
  /function TodayView\(\{ tasks, toggleTask, deleteTask, updateTask, onTaskClick, notificationPermission, onRequestPermission, setView, aiRecommendation, isAiLoading, getAiRecommendation, weather, weatherLoading, fetchWeather \}: \{ tasks: Task\[\], toggleTask: \(id: string, current: boolean\) => void, deleteTask: \(id: string\) => void, updateTask: \(id: string, updates: Partial<Task>\) => void, onTaskClick: \(task: Task\) => void, notificationPermission: NotificationPermission, onRequestPermission: \(\) => void, setView: \(view: any\) => void, aiRecommendation: string \| null, isAiLoading: boolean, getAiRecommendation: \(\) => void, weather: \{ temp: number, code: number, isDay: number \} \| null, weatherLoading: boolean, fetchWeather: \(\) => void \}\) \{/,
  `import { Mail } from "lucide-react"; // Wait, Mail is probably not imported, let's just do it directly.

function TodayView({ tasks, toggleTask, deleteTask, updateTask, onTaskClick, notificationPermission, onRequestPermission, setView, gmailToken, gmailEmails, isFetchingEmails, handleGmailLogin, weather, weatherLoading, fetchWeather }: { tasks: Task[], toggleTask: (id: string, current: boolean) => void, deleteTask: (id: string) => void, updateTask: (id: string, updates: Partial<Task>) => void, onTaskClick: (task: Task) => void, notificationPermission: NotificationPermission, onRequestPermission: () => void, setView: (view: any) => void, gmailToken: string | null, gmailEmails: any[], isFetchingEmails: boolean, handleGmailLogin: () => void, weather: { temp: number, code: number, isDay: number } | null, weatherLoading: boolean, fetchWeather: () => void }) {`
);

// Update TodayView usage
code = code.replace(
  /<TodayView \s*tasks=\{tasks\}\s*toggleTask=\{toggleTask\}\s*deleteTask=\{deleteTask\}\s*updateTask=\{updateTask\}\s*onTaskClick=\{setSelectedTask\}\s*notificationPermission=\{notificationPermission\}\s*onRequestPermission=\{onRequestPermission\}\s*setView=\{setView\}\s*weather=\{weather\}\s*weatherLoading=\{weatherLoading\}\s*fetchWeather=\{\(\) => fetchWeather\(\)\}\s*aiRecommendation=\{aiRecommendation\}\s*isAiLoading=\{isAiLoading\}\s*getAiRecommendation=\{getAiRecommendation\}\s*\/>/m,
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
              fetchWeather={() => fetchWeather()}
              gmailToken={gmailToken}
              gmailEmails={gmailEmails}
              isFetchingEmails={isFetchingEmails}
              handleGmailLogin={handleGmailLogin}
            />`
);

// Wait, the previous usage was on multiple lines. Let's do a more robust replace for the usage.
fs.writeFileSync('patch_today_props.cjs', fs.readFileSync('patch_today_props.cjs', 'utf8').replace(/<TodayView[\\s\\S]*?\\/>/, '...'));
// Let me write a better script to replace the <TodayView />
