import { useEffect } from 'react';
import '../styles/globals.css';
import { AuthProvider } from '../context/AuthContext';

export default function App({ Component, pageProps }) {
  // Suppress MetaMask extension errors — this app does not use Web3/MetaMask
  useEffect(() => {
    const handler = (event) => {
      const msg = event?.reason?.message || event?.message || '';
      const filename = event?.filename || '';
      if (
        msg.includes('MetaMask') ||
        msg.includes('inpage') ||
        msg.includes('ethereum') ||
        filename.includes('nkbihfbeogaeaoehlefnkodbefgpgknn')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('unhandledrejection', handler);
    window.addEventListener('error', handler);
    return () => {
      window.removeEventListener('unhandledrejection', handler);
      window.removeEventListener('error', handler);
    };
  }, []);

  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

