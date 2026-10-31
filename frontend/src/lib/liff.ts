// LINE LIFF Helper for FatCat POS Refactor

declare global {
  interface Window {
    liff?: any;
  }
}

export interface LineUserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export async function initLiff(liffId: string): Promise<LineUserProfile | null> {
  if (!liffId) return null;

  // Safeguard: Never force LINE login on admin domain or admin routes
  const isAdmin = typeof window !== 'undefined' && (
    window.location.hostname.startsWith('admin.') ||
    window.location.pathname.startsWith('/admin') ||
    window.location.hash.startsWith('#admin')
  );
  if (isAdmin) {
    return null;
  }

  try {
    if (!window.liff) {
      console.warn('LIFF SDK not loaded yet');
      return null;
    }

    await window.liff.init({ liffId });

    if (window.liff.isLoggedIn()) {
      // Clear attempt flag once successfully logged in
      sessionStorage.removeItem('liff_login_attempted');

      const profile = await window.liff.getProfile();
      if (profile && profile.userId) {
        const userProfile: LineUserProfile = {
          userId: profile.userId,
          displayName: profile.displayName || '',
          pictureUrl: profile.pictureUrl || '',
          statusMessage: profile.statusMessage || '',
        };
        // Cache in localStorage
        localStorage.setItem('fatcat_line_user_id', userProfile.userId);
        localStorage.setItem('fatcat_line_display_name', userProfile.displayName);
        if (userProfile.pictureUrl) {
          localStorage.setItem('fatcat_line_picture_url', userProfile.pictureUrl);
        }

        // Auto sync with backend customer login API
        try {
          await fetch('/api/customer-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              line_user_id: userProfile.userId,
              display_name: userProfile.displayName,
              picture_url: userProfile.pictureUrl,
              status_message: userProfile.statusMessage,
            }),
          });
        } catch (e) {
          console.warn('Customer login sync error:', e);
        }

        return userProfile;
      }
    } else {
      // User is NOT logged in yet.
      // Auto-trigger LINE Login ONLY when opened inside the LINE app (isInClient === true)
      // so external browser visitors (Chrome / Safari / Portfolio iframe) can browse as Guest without forced redirect.
      const isInClient = typeof window.liff.isInClient === 'function' && window.liff.isInClient();
      const loginAttempted = sessionStorage.getItem('liff_login_attempted');
      let isInIframe = false;
      try {
        isInIframe = window.self !== window.top;
      } catch {
        isInIframe = true;
      }

      if (isInClient && !isInIframe && !loginAttempted) {
        sessionStorage.setItem('liff_login_attempted', '1');
        window.liff.login({ redirectUri: window.location.href });
        return null;
      }
    }
  } catch (error) {
    console.error('LIFF Init error:', error);
  }
  return null;
}

export function loginWithLine() {
  if (window.liff) {
    try {
      if (!window.liff.isLoggedIn()) {
        sessionStorage.removeItem('liff_login_attempted');
        window.liff.login({ redirectUri: window.location.href });
        return;
      }
    } catch (e) {
      console.error('LIFF login error:', e);
    }
  }
}

export function logoutLine() {
  localStorage.removeItem('fatcat_line_user_id');
  localStorage.removeItem('fatcat_line_display_name');
  localStorage.removeItem('fatcat_line_picture_url');
  if (window.liff && window.liff.isLoggedIn()) {
    try {
      window.liff.logout();
    } catch {}
  }
}
