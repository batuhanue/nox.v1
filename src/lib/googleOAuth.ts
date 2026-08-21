import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  reauthenticateWithPopup, 
  User, 
  UserCredential 
} from 'firebase/auth';
import { auth } from '../firebase';

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

/**
 * Extracts error code from Firebase or OAuth error objects
 */
export function getOAuthErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as any).code);
  }
  return '';
}

/**
 * Normalizes Firebase and Google OAuth errors into localized Turkish messages for users
 */
export function normalizeOAuthError(error: unknown): string {
  const code = getOAuthErrorCode(error);
  
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Oturum açma penceresi işlem tamamlanmadan kapatıldı.';
    case 'auth/cancelled-popup-request':
      return 'Önceki oturum açma isteği iptal edildi.';
    case 'auth/popup-blocked':
      return 'Açılır pencere tarayıcı tarafından engellendi. Lütfen tarayıcı ayarlarından açılır pencerelere izin verin.';
    case 'auth/network-request-failed':
      return 'Ağ bağlantısı hatası. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.';
    case 'auth/unauthorized-domain':
      return 'Bu alan adı Firebase Authentication için yetkilendirilmemiş.';
    case 'auth/account-exists-with-different-credential':
      return 'Bu e-posta adresi farklı bir giriş yöntemiyle ilişkilendirilmiş.';
    case 'auth/requires-recent-login':
      return 'Güvenlik nedeniyle bu işlem için yakın zamanda giriş yapmış olmanız gerekir. Lütfen tekrar giriş yapın.';
    case 'auth/user-mismatch':
      return 'Seçilen Google hesabı, giriş yapmış olan kullanıcı ile eşleşmiyor. Lütfen aynı hesabı seçin.';
    case 'auth/credential-already-in-use':
      return 'Bu Google hesabı zaten başka bir kullanıcı tarafından kullanılıyor.';
    case 'auth/invalid-credential':
      return 'Kimlik bilgisi geçersiz veya süresi dolmuş.';
    case 'auth/operation-not-allowed':
      return 'Bu oturum açma sağlayıcısı Firebase yapılandırmasında etkinleştirilmemiş.';
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return 'Yetkilendirme sırasında bir hata oluştu.';
  }
}

/**
 * Detailed console logging for developer debugging
 */
export function logOAuthError(context: string, error: unknown) {
  const code = getOAuthErrorCode(error);
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[OAuth Error] Context: ${context}`, {
    code,
    message,
    errorObject: error,
  });
}

/**
 * Factory for creating GoogleAuthProvider with specific scopes and parameters
 */
export function createGoogleProvider(scopes: string[] = [], customParams?: Record<string, string>): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of scopes) {
    provider.addScope(scope);
  }
  if (customParams) {
    provider.setCustomParameters(customParams);
  }
  return provider;
}

/**
 * Extracts Google OAuth access token from a UserCredential
 */
export function getGoogleAccessToken(result: UserCredential): string | null {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  return credential?.accessToken || null;
}

/**
 * 1. Core NOX Firebase Login
 * Requests minimum identity scopes ONLY (no Calendar, no Gmail).
 */
export async function handleFirebaseLogin(): Promise<UserCredential> {
  const provider = createGoogleProvider([], {
    prompt: 'select_account',
  });
  
  try {
    const result = await signInWithPopup(auth, provider);
    return result;
  } catch (error) {
    logOAuthError('handleFirebaseLogin', error);
    throw error;
  }
}

/**
 * 2. Dedicated Google Calendar Authorization
 * Requests only Calendar events scope for an already authenticated Firebase user.
 */
export async function handleConnectCalendar(currentUser?: User | null): Promise<string> {
  const user = currentUser || auth.currentUser;
  if (!user) {
    const err = new Error('Takvim bağlantısı için önce NOX oturumu açmalısınız.');
    logOAuthError('handleConnectCalendar', err);
    throw err;
  }

  const calendarProvider = createGoogleProvider([CALENDAR_SCOPE], {
    prompt: 'consent',
  });

  try {
    const result = await reauthenticateWithPopup(user, calendarProvider);
    const token = getGoogleAccessToken(result);
    if (!token) {
      throw new Error('Google Takvim erişim anahtarı alınamadı.');
    }
    return token;
  } catch (error) {
    logOAuthError('handleConnectCalendar', error);
    throw error;
  }
}

/**
 * 3. Dedicated Gmail Authorization
 * Requests only Gmail readonly scope for an already authenticated Firebase user.
 */
export async function handleConnectGmail(currentUser?: User | null): Promise<string> {
  const user = currentUser || auth.currentUser;
  if (!user) {
    const err = new Error('Gmail bağlantısı için önce NOX oturumu açmalısınız.');
    logOAuthError('handleConnectGmail', err);
    throw err;
  }

  const gmailProvider = createGoogleProvider([GMAIL_READONLY_SCOPE], {
    prompt: 'consent',
  });

  try {
    const result = await reauthenticateWithPopup(user, gmailProvider);
    const token = getGoogleAccessToken(result);
    if (!token) {
      throw new Error('Gmail erişim anahtarı alınamadı.');
    }
    return token;
  } catch (error) {
    logOAuthError('handleConnectGmail', error);
    throw error;
  }
}
