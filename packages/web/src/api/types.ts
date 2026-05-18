import type { UseQueryOptions } from '@tanstack/react-query';

export type QueryOptions<TData = unknown> = Omit<UseQueryOptions<TData>, 'queryKey'>;

export type MutationOptions<TData = unknown, TVariables = unknown> = {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error) => void;
};
