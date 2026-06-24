import { useEffect } from 'react';
import '../styles/globals.css';
import { AuthProvider } from '../context/AuthContext';

export default function App({ Component, pageProps }) {
  // Suppress MetaMask extension errors — this app does not use Web3/MetaMask
  useEffect(() => {
    const handler = (event) => {
      const msg = event?.reason?.message || event?.message || '';
      if (
        msg.includes('MetaMask') ||
        msg.includes('inpage.js') ||
        msg.includes('ethereum')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

