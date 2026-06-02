import { useEffect } from 'react';

export function TabIdentity() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const originalTitle = document.title;
    
    const amberIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23FFB347'/%3E%3C/svg%3E";
    const redIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23FF4747'/%3E%3C/svg%3E";
    
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    let originalIcon = link?.href || '/favicon.png';
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        document.title = '[ Connection lost ]';
        link.href = redIcon;
      } else {
        document.title = originalTitle;
        link.href = originalIcon;
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  return null;
}
