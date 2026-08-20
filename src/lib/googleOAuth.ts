import { GoogleAuthProvider, signInWithPopup, reauthenticateWithPopup, UserCredential, User } from 'firebase/auth';
import { auth } from '../firebase';

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

/**
 * Normalizes Firebase and Google OAuth errors into user-friendly Turkish messages
 * while preserving console diagnostic logs.
 */
export function getOAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Bilinmeyen bir hata oluştu. Lütfen tekrar deneyin.';
  }

  const err = error as { code?: string; message?: string; status?: number };
  const errorCode = err.code || '';

  switch (errorCode) {
    case 'auth/popup-closed-by-user':
      return 'Giriş penceresi kullanıcı tarafından kapatıldı.';
    case 'auth/cancelled-popup-request':
      return 'Giriş isteği iptal edildi.';
    case 'auth/popup-blocked':
      return 'Açılır pencere tarayıcı tarafından engellendi. Lütfen açılır pencerelere izin verin.';
    case 'auth/network-request-failed':
      return 'Ağ bağlantısı hatası oluştu. Lütfen internet bağlantınızı kontrol edin.';
    case 'auth/unauthorized-domain':
      return 'Bu alan adı yetkilendirilmemiş. Lütfen Firebase Console ayarlarını kontrol edin.';
    case 'auth/account-exists-with-different-credential':
      return 'Bu e-posta adresiyle ilişkili farklı bir hesap mevcut.';
    case 'auth/requires-recent-login':
      return 'Güvenlik nedeniyle bu işlem için yakın zamanda yeniden giriş yapmış olmanız gerekir.';
    case 'auth/invalid-credential':
      return 'Geçersiz kimlik bilgisi. Lütfen tekrar deneyin.';
    case 'auth/user-disabled':
      return 'Bu kullanıcı hesabı devre dışı bırakılmış.';
    default:
      if (err.message && err.message.includes('401')) {
        return 'Oturum süresi doldu veya yetkilendirme geçersiz.';
      }
      return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
}

export const normalizeOAuthError = getOAuthErrorMessage;

/**
 * Factory for GoogleAuthProvider instances.
 */
export function createGoogleProvider(scopes: string[] = [], customParameters: Record<string, string> = {}): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  scopes.forEach(scope => provider.addScope(scope));
  if (Object.keys(customParameters).length > 0) {
    provider.setCustomParameters(customParameters);
  }
  return provider;
}

/**
 * Extracts OAuth Access Token from Firebase UserCredential
 */
export function getGoogleAccessToken(result: UserCredential): string | null {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  return credential?.accessToken || null;
}

/**
 * 1. Core NOX Firebase Authentication
 * Pure Firebase login WITHOUT requesting Calendar or Gmail scopes.
 */
export async function handleFirebaseLogin(): Promise<UserCredential> {
  const provider = createGoogleProvider([], { prompt: 'select_account' });
  try {
    const result = await signInWithPopup(auth, provider);
    return result;
  } catch (error: any) {
    console.error('Firebase Core Login Error:', {
      code: error?.code,
      message: error?.message,
      error
    });
    throw error;
  }
}

/**
 * 2. Dedicated Google Calendar Authorization
 * Requests ONLY calendar.events scope for an already-authenticated NOX user.
 */
export async function handleConnectCalendar(currentUser?: User | null): Promise<string | null> {
  const user = currentUser || auth.currentUser;
  if (!user) {
    const errorMsg = 'Takvim bağlantısı için önce NOX oturumu açılmış olmalıdır.';
    console.error('Calendar Authorization Error: No authenticated user.');
    throw new Error(errorMsg);
  }

  const provider = createGoogleProvider([CALENDAR_SCOPE], { prompt: 'consent' });

  try {
    const result = await signInWithPopup(auth, provider);
    const accessToken = getGoogleAccessToken(result);
    if (!accessToken) {
      console.warn('Calendar Authorization completed but no accessToken was returned.');
    }
    return accessToken;
  } catch (error: any) {
    console.error('Calendar Authorization Error:', {
      code: error?.code,
      message: error?.message,
      error
    });
    throw error;
  }
}

/**
 * 3. Dedicated Gmail Authorization
 * Requests ONLY gmail.readonly scope for an already-authenticated NOX user.
 */
export async function handleConnectGmail(currentUser?: User | null): Promise<string | null> {
  const user = currentUser || auth.currentUser;
  if (!user) {
    const errorMsg = 'Gmail bağlantısı için önce NOX oturumu açılmış olmalıdır.';
    console.error('Gmail Authorization Error: No authenticated user.');
    throw new Error(errorMsg);
  }

  const provider = createGoogleProvider([GMAIL_SCOPE], { prompt: 'consent' });

  try {
    const result = await signInWithPopup(auth, provider);
    const accessToken = getGoogleAccessToken(result);
    if (!accessToken) {
      console.warn('Gmail Authorization completed but no accessToken was returned.');
    }
    return accessToken;
  } catch (error: any) {
    console.error('Gmail Authorization Error:', {
      code: error?.code,
      message: error?.message,
      error
    });
    throw error;
  }
}
