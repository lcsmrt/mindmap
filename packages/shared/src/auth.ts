export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface SignupBody {
  email: string;
  password: string;
  name: string;
  remember?: boolean;
}

export interface LoginBody {
  email: string;
  password: string;
  remember?: boolean;
}

export interface UpdateProfileBody {
  name: string;
}

export interface ForgotPasswordBody {
  email: string;
}

export interface ResetPasswordBody {
  token: string;
  password: string;
  logoutOtherDevices?: boolean;
}

export type AuthResponse = AuthUser;
