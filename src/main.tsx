import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './app/App.tsx';
import './styles/index.css';
import { AuthProvider } from './context/AuthContext.tsx';
import { DataProvider } from './context/DataContext.tsx';
import { Toaster } from './app/components/ui/sonner.tsx';
import { ErrorBoundary } from './app/components/ErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <App />
          <Toaster position="top-right" richColors />
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
);
  