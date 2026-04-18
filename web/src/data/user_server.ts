import { http } from './server_tools';

const ACCESS_TOKEN_KEY = 'what2eat-access-token';
const TOKEN_TYPE_KEY = 'what2eat-token-type';
const USER_ID_KEY = 'what2eat_user_id';
const USER_EMAIL_KEY = 'what2eat_user_email';
const USER_NAME_KEY = 'what2eat_user_name';


export interface UserCreateReq {
  email: string;
  password: string;
  full_name?: string | null;
}

export interface UserLoginReq {
  email: string;
  password: string;
}

export interface UserReadResp {
  id: string;
  email: string;
  full_name: string | null;
}

export interface LoginResp {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserReadResp;
}

export interface SessionUser {
  id: string;
  email: string;
  full_name: string | null;
}

function setCurrentUser(user: UserReadResp): void {
  sessionStorage.setItem(USER_ID_KEY, user.id);
  sessionStorage.setItem(USER_EMAIL_KEY, user.email);
  sessionStorage.setItem(USER_NAME_KEY, user.full_name ?? '');
}

function clearCurrentUser(): void {
  sessionStorage.removeItem(USER_ID_KEY);
  sessionStorage.removeItem(USER_EMAIL_KEY);
  sessionStorage.removeItem(USER_NAME_KEY);
}

function persistSession(resp: LoginResp): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, resp.access_token);
  sessionStorage.setItem(TOKEN_TYPE_KEY, resp.token_type);
  setCurrentUser(resp.user);
}

export async function registerApi(req: UserCreateReq): Promise<LoginResp> {
  const resp = await http<LoginResp, UserCreateReq>('/auth/register', {
    method: 'POST',
    body: req,
  });
  persistSession(resp);
  return resp;
}

export async function loginApi(req: UserLoginReq): Promise<LoginResp> {
  const resp = await http<LoginResp, UserLoginReq>('/auth/login', {
    method: 'POST',
    body: req,
  });

  persistSession(resp);
  return resp;
}

export function logoutApi(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_TYPE_KEY);
  clearCurrentUser();
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getAuthorizationHeader(): string | null {
  const token = getAccessToken();
  const tokenType = sessionStorage.getItem(TOKEN_TYPE_KEY) || 'bearer';
  if (!token) {
    return null;
  }
  return `${tokenType} ${token}`;
}

export function getCurrentUser(): SessionUser | null {
  const id = sessionStorage.getItem(USER_ID_KEY);
  const email = sessionStorage.getItem(USER_EMAIL_KEY);

  if (!id || !email) {
    return null;
  }

  const full_name = sessionStorage.getItem(USER_NAME_KEY);
  return {
    id,
    email,
    full_name: full_name || null,
  };
}
