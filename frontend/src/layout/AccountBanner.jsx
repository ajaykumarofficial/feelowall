import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../pages/auth/useAuth';
import { account, errorMessage } from '../services/platformService';
import { useI18n } from '../i18n';

const DISMISS_KEY = 'feelowall-email-banner-dismissed';

const wasDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

/** Existing accounts without a confirmed email get a reminder, which they can dismiss for the session. */
const AccountBanner = ({ showToast }) => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (!user || dismissed || user.emailVerified) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // It'll just reappear on the next page load.
    }
  };

  const resend = async () => {
    try {
      const res = await account.resendVerification();
      showToast(res.message, 'success');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="fw-banner" role="status">
      <span>{user.email ? t('banner.confirmEmail') : t('banner.addEmail')}</span>
      <div className="fw-row">
        {user.email ? (
          <button type="button" className="fw-link" onClick={resend}>{t('banner.resend')}</button>
        ) : (
          <button type="button" className="fw-link" onClick={() => navigate('/settings')}>{t('banner.addEmailAction')}</button>
        )}
        <button type="button" className="fw-link fw-muted" onClick={dismiss}>{t('banner.dismiss')}</button>
      </div>
    </div>
  );
};

export default AccountBanner;
