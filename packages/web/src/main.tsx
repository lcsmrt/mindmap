import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles.css';
import App from './App.js';
import { ToastProvider } from './components/ui/toast.js';
import { Toaster } from './components/ui/toaster.js';

const queryClient = new QueryClient();

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
