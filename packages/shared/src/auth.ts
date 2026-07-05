export interface AuthUser {
  id: string;
  email: string;
  username: string;
  name: string;
}

export interface SignupBody {
  email: string;
  username: string;
  password: string;
  name: string;
  remember?: boolean;
}

export interface LoginBody {
  identifier: string;
  password: string;
  remember?: boolean;
}

export interface UpdateProfileBody {
  name: string;
  username?: string;
}

export interface ForgotPasswordBody {
  email: string;
}

export interface ResetPasswordBody {
  token: string;
  password: string;
  logoutOtherDevices?: boolean;
}

export interface ResetTokenStatus {
  valid: boolean;
}

export type AuthResponse = AuthUser;
