import { handleFirebaseLogin, handleConnectCalendar, handleConnectGmail, getOAuthErrorMessage, createGoogleProvider } from './googleOAuth';

export const googleProvider = createGoogleProvider();
export { handleFirebaseLogin, handleConnectCalendar, handleConnectGmail, getOAuthErrorMessage };

