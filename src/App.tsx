import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { THEME_STORAGE_KEY, THEMES } from '@/lib/theme';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const ThemedToaster: React.FC = () => {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey={THEME_STORAGE_KEY}
        themes={[...THEMES]}
        disableTransitionOnChange
        enableColorScheme
      >
        <TooltipProvider>
          <RouterProvider router={router} />
          <ThemedToaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
