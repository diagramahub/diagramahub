export type UserRole = 'admin' | 'user';

export type User = {
  id: string;
  email: string;
  full_name?: string;
  profile_picture?: string;  // Base64 encoded image
  timezone?: string;  // User's preferred timezone (IANA format)
  language?: string;  // User's preferred language
  role?: UserRole;  // User role (admin or regular user)
  is_active: boolean;
  created_at: string;
  subscription?: {
    plan: {
      price_usd: number;
      name: string;
      max_projects: number | null;
      max_diagrams: number | null;
    };
  };
}

export type InstallationStatus = {
  needs_setup: boolean;
  user_count: number;
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

export type UpdateProfileRequest = {
  full_name?: string;
  profile_picture?: string;  // Base64 encoded image
  timezone?: string;  // User's preferred timezone (IANA format)
}

export type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  mfaEnabled: boolean;
  login: (email: string, password: string) => Promise<LoginResponse | void>;
  completeMfaLogin: (accessToken: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

// MFA Types
export interface MfaLoginResponse {
  mfa_required: boolean;
  mfa_token: string;
  mfa_default_method: string;
  available_methods: string[];
}

export interface MfaVerifyRequest {
  mfa_token: string;
  code: string;
  method?: string;
  is_recovery_code?: boolean;
}

export interface MfaStatusResponse {
  enabled: boolean;
  methods: string[];
  default_method: string | null;
  recovery_codes_remaining: number;
}

export interface MfaSetupTotpResponse {
  qr_code_base64: string;
  secret_key: string;
}

export interface RecoveryCodesResponse {
  codes: string[];
}

export interface MfaResendResponse {
  message: string;
  resends_remaining: number;
}

export interface MfaVerifyResponse {
  access_token: string;
  token_type: string;
  recovery_warning?: string;
}

export interface LoginResponse {
  access_token?: string;
  token_type?: string;
  mfa_enabled?: boolean;
  mfa_required?: boolean;
  mfa_token?: string;
  mfa_default_method?: string;
  available_methods?: string[];
}

export interface AdminUserMfaInfo {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  mfa_enabled: boolean;
  mfa_methods: string[];
  mfa_default_method: string | null;
  recovery_codes_remaining: number;
  created_at: string | null;
  plan_name: string | null;
}

export interface PaginatedAdminUsers {
  items: AdminUserMfaInfo[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
