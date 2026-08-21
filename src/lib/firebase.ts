import { handleFirebaseLogin, createGoogleProvider } from './googleOAuth';

export const googleProvider = createGoogleProvider();
export const signInWithGoogle = handleFirebaseLogin;

