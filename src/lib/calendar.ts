export const addEventToGoogleCalendar = async (title: string, priority: string | null, dateStr: string) => {
  const token = localStorage.getItem('google_calendar_token');
  if (!token) {
    console.warn("No google calendar token found.");
    alert("Google Takvim erişim yetkisi alınamadı. Oturum açarken istenen yetkilere izin verdiğinizden emin olun veya yeniden giriş yapın.");
    return false;
  }

  // Google Calendar API expects ISO string format for start and end times (RFC3339)
  // Or for all-day events, just "date": "YYYY-MM-DD"
  
  const event = {
    summary: priority ? `[${priority.toUpperCase()}] ${title}` : title,
    description: `Added from NOX To-Do`,
    start: {
      date: dateStr, // YYYY-MM-DD
    },
    end: {
      date: dateStr, // YYYY-MM-DD (all day event)
    }
  };

  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('google_calendar_token');
        console.error("Google Calendar token expired.");
        alert("Takvim oturumunuzun süresi dolmuş. Lütfen çıkış yapıp tekrar giriş yapın.");
      } else if (response.status === 403) {
        console.error("Google Calendar permission error.");
        alert("Google Takvim erişim yetkisi alınamadı. Oturum açarken istenen yetkilere izin verdiğinizden emin olun.");
      } else {
        console.error(`Google Calendar err: ${response.status}`);
      }
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error adding to Google Calendar:", error);
    return false;
  }
};
