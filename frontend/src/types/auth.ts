export type User = {
  id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  created_at: string;
}

export type LoginRequest = {
  email: string;
  password: string;
}

export type RegisterRequest = {
  email: string;
  password: string;
  full_name?: string;
}

export type AuthResponse = {
  access_token: string;
  token_type: string;
}

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
}

export type ResetPasswordRequest = {
  email: string;
}

export type ResetPasswordConfirm = {
  email: string;
  token: string;
  new_password: string;
}

export type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}
