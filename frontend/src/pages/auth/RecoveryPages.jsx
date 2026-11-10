import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { account, errorMessage } from '../../services/platformService';
import { Empty, Field, Loading, Page, Panel } from '../../components/ui';
import { useAuth } from './useAuth';
import { OAUTH_STATE_KEY } from './AuthModal';

const stripQuery = () => window.history.replaceState({}, '', window.location.pathname);

export const VerifyEmailPage = () => {
  const [params] = useSearchParams();
  const { refreshUser } = useAuth();
  const [state, setState] = useState({ status: 'working' });
  const sent = useRef(false);

  useEffect(() => {
    // Tokens work once, and React's development mode runs effects twice.
    if (sent.current) return;
    sent.current = true;
    const token = params.get('token');
    stripQuery();
    account.verifyEmail(token)
      .then((res) => {
        setState({ status: 'done', message: res.message });
        refreshUser();
      })
      .catch((err) => setState({ status: 'failed', message: errorMessage(err, 'This link is invalid or has expired.') }));
  }, []);

  return (
    <Page title="Confirm Your Email">
      {state.status === 'working' && <Loading label="Confirming..." />}
      {state.status === 'done' && <Empty icon={CheckCircle} title={state.message}>You can now use this address to recover your account.</Empty>}
      {state.status === 'failed' && <Empty icon={AlertTriangle} title="We couldn't confirm that link">{state.message} You can request a new one in Account Settings.</Empty>}
    </Page>
  );
};

export const ResetPasswordPage = ({ showToast }) => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { openAuth } = useAuth();
  const [token] = useState(() => params.get('token'));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(stripQuery, []);

  const submit = async (event) => {
    event.preventDefault();
    if (password !== confirm) {
      showToast('Those passwords don\'t match.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await account.resetPassword(token, password);
      showToast(res.message, 'success');
      navigate('/');
      openAuth('login');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <Page title="Reset Your Password">
        <Empty icon={AlertTriangle} title="This link is missing its code">Open the link from your email again, or request a new one from the login window.</Empty>
      </Page>
    );
  }

  return (
    <Page title="Reset Your Password" description="Choose a new password. Other devices will be signed out.">
      <Panel>
        <form onSubmit={submit} className="fw-form">
          <Field label="New password"><input type="password" className="fw-input" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          <Field label="Confirm new password"><input type="password" className="fw-input" autoComplete="new-password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></Field>
          <button type="submit" className="btn btn-primary" disabled={busy}>Update Password</button>
        </form>
      </Panel>
    </Page>
  );
};

/** Where sign-in providers send people back to. */
export const OAuthCallbackPage = ({ showToast }) => {
  const { provider } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession, openAuth, beginTwoFactor } = useAuth();
  const [error, setError] = useState(null);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const denied = params.get('error');
    const expected = sessionStorage.getItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    stripQuery();

    if (denied) {
      setError('Sign-in was cancelled.');
      return;
    }
    // This must be the same browser that started sign-in, or someone could log the
    // visitor into an attacker's account with a crafted link.
    if (!code || !state || state !== expected) {
      setError('This sign-in link is no longer valid. Please try again.');
      return;
    }

    account.oauthCallback(provider, code, state)
      .then((data) => {
        if (data.twoFactorRequired) {
          // These accounts have no usable password, so go straight to asking for the code.
          beginTwoFactor(data.challenge);
          navigate('/');
          openAuth('login');
          return;
        }
        setSession(data);
        showToast(`Welcome, ${data.user.username}!`, 'success');
        navigate('/');
      })
      .catch((err) => setError(errorMessage(err, 'Sign-in failed. Please try again.')));
  }, []);

  return (
    <Page title="Signing You In">
      {error ? (
        <Empty icon={AlertTriangle} title="We couldn't sign you in">{error}</Empty>
      ) : <Loading label="Finishing sign-in..." />}
    </Page>
  );
};
