import crypto from 'crypto';
import { cookies } from 'next/headers';

const SECRET_KEY = process.env.JWT_SECRET || 'sws-survey-default-super-secret-key-2026';
const COOKIE_NAME = 'sws_session_token';

export interface UserSession {
  id: number;
  username: string;
  name: string;
  role: string;
  position: string;
}

export function createToken(payload: UserSession): string {
  const data = JSON.stringify({
    payload,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  });
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex');
  return `${Buffer.from(data).toString('base64')}.${signature}`;
}

export function verifyToken(token: string): UserSession | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    
    const data = Buffer.from(parts[0], 'base64').toString('utf8');
    const signature = parts[1];
    
    const expectedSignature = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex');
    if (signature !== expectedSignature) {
      return null;
    }
    
    const parsed = JSON.parse(data);
    if (parsed.exp < Date.now()) {
      return null; // Expired
    }
    
    return parsed.payload;
  } catch (e) {
    return null;
  }
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSession(user: UserSession) {
  const token = createToken(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60, // 1 day
    path: '/'
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// SHA-256 password hashing helper matching Eng Daily Report behavior
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}
