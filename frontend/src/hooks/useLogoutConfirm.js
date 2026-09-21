import React, { useCallback, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

/**
 * Ask before signing out. Pass `requestLogout` as the menu Log out action.
 */
export default function useLogoutConfirm(logout, navigate, { homeTo = '/' } = {}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const requestLogout = useCallback(() => {
    setOpen(true);
  }, []);

  const onClose = useCallback(() => {
    if (!busy) setOpen(false);
  }, [busy]);

  const onConfirm = useCallback(async () => {
    setBusy(true);
    try {
      await logout();
      navigate(homeTo);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }, [logout, navigate, homeTo]);

  const logoutConfirmDialog = (
    <ConfirmDialog
      open={open}
      title="Log out?"
      message="You’ll need to sign in again to use your account."
      confirmLabel="Log out"
      cancelLabel="Stay signed in"
      tone="danger"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );

  return { requestLogout, logoutConfirmDialog };
}
