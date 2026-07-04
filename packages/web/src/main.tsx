import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles.css';
import App from './App.js';
import { ApiError } from './api/_request.js';
import { ToastProvider } from './components/ui/toast.js';
import { Toaster } from './components/ui/toaster.js';

const AUTH_ME_KEY = ['auth', 'me'];

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const isAuthMeQuery =
        query.queryKey.length === AUTH_ME_KEY.length &&
        query.queryKey.every((part, i) => part === AUTH_ME_KEY[i]);
      if (!isAuthMeQuery && error instanceof ApiError && error.status === 401) {
        queryClient.setQueryData(AUTH_ME_KEY, null);
      }
    },
  }),
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <Toaster />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
