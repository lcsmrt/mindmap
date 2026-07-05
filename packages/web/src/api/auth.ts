import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AuthUser,
  SignupBody,
  LoginBody,
  UpdateProfileBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from '@mindmap/shared';
import type { MutationOptions } from './types.js';
import { request, ApiError } from './_request.js';

const ME_KEY = ['auth', 'me'] as const;

async function signupRequest(body: SignupBody): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function loginRequest(body: LoginBody): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function logoutRequest(): Promise<void> {
  return request<void>('/api/auth/logout', { method: 'POST' });
}

async function updateProfileRequest(body: UpdateProfileBody): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function forgotPasswordRequest(body: ForgotPasswordBody): Promise<void> {
  return request<void>('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function resetPasswordRequest(body: ResetPasswordBody): Promise<void> {
  return request<void>('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function validateResetTokenRequest(token: string): Promise<void> {
  return request<void>(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
}

async function fetchMe(): Promise<AuthUser | null> {
  try {
    return await request<AuthUser>('/api/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export const useSession = () => {
  const { data, isLoading } = useQuery({
    queryKey: ME_KEY,
    queryFn: fetchMe,
    retry: false,
    staleTime: Infinity,
  });

  return { user: data ?? null, isLoading, isAuthenticated: !!data };
};

export const useSignup = (options?: MutationOptions<AuthUser, SignupBody>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signupRequest,
    onSuccess: (user, variables) => {
      queryClient.setQueryData(ME_KEY, user);
      options?.onSuccess?.(user, variables);
    },
    onError: (error) => options?.onError?.(error),
  });
};

export const useLogin = (options?: MutationOptions<AuthUser, LoginBody>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loginRequest,
    onSuccess: (user, variables) => {
      queryClient.setQueryData(ME_KEY, user);
      options?.onSuccess?.(user, variables);
    },
    onError: (error) => options?.onError?.(error),
  });
};

export const useUpdateProfile = (options?: MutationOptions<AuthUser, UpdateProfileBody>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfileRequest,
    onSuccess: (user, variables) => {
      queryClient.setQueryData(ME_KEY, user);
      options?.onSuccess?.(user, variables);
    },
    onError: (error) => options?.onError?.(error),
  });
};

export const useForgotPassword = (options?: MutationOptions<void, ForgotPasswordBody>) =>
  useMutation({
    mutationFn: forgotPasswordRequest,
    onSuccess: (data, variables) => options?.onSuccess?.(data, variables),
    onError: (error) => options?.onError?.(error),
  });

export const useResetPassword = (options?: MutationOptions<void, ResetPasswordBody>) =>
  useMutation({
    mutationFn: resetPasswordRequest,
    onSuccess: (data, variables) => options?.onSuccess?.(data, variables),
    onError: (error) => options?.onError?.(error),
  });

export const useValidateResetToken = (token: string) =>
  useQuery({
    queryKey: ['auth', 'reset-validate', token],
    queryFn: async () => {
      await validateResetTokenRequest(token);
      return true;
    },
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });

export const useLogout = (options?: MutationOptions<void, void>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logoutRequest,
    onSuccess: (data, variables) => {
      options?.onSuccess?.(data, variables);
      queryClient.clear();
      queryClient.setQueryData(ME_KEY, null);
    },
    onError: (error) => options?.onError?.(error),
  });
};
