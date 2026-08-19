import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { APIProvider } from '@vis.gl/react-google-maps';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

function Root() {
  if (!hasValidKey) {
    // We will render App directly and pass a prop or context if needed,
    // but the simplest is just rendering App without APIProvider.
    // The components relying on maps should gracefully handle being out of context,
    // or we provide a dummy context, but react-google-maps useMapsLibrary gracefully returns null if context is missing or key is invalid.
    return <App />;
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <App />
    </APIProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
