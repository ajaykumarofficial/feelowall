import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Download, Trash2, X } from 'lucide-react';
import { useAuth } from './useAuth';
import { account, discovery, errorMessage, mediaUrl, saveText } from '../../services/platformService';
import { Field, Page, Panel, Tabs, dateOnly, timeAgo } from '../../components/ui';

const useRunner = (showToast) => {
  const [busy, setBusy] = useState(false);
  const run = async (action, onSuccess) => {
    setBusy(true);
    try {
      const result = await action();
      if (result?.message) showToast(result.message, 'success');
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      showToast(errorMessage(err), 'error');
      return null;
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
};

const EmailPanel = ({ showToast }) => {
  const { user, updateUserData } = useAuth();
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const [busy, run] = useRunner(showToast);

  const save = (event) => {
    event.preventDefault();
    run(() => account.setEmail(email, password), (res) => {
      updateUserData(res.user);
      setPassword('');
    });
  };

  return (
    <Panel title="Email" description="Used for password recovery. Payouts also need a confirmed address.">
      <p className="fw-status">
        {user.email ? (user.emailVerified ? `${user.email} is confirmed.` : `${user.email} isn't confirmed yet.`) : 'No email address yet.'}
        {user.email && !user.emailVerified && (
          <button type="button" className="fw-link" disabled={busy} onClick={() => run(account.resendVerification)}> Resend email</button>
        )}
      </p>
      <form onSubmit={save} className="fw-form">
        <Field label="Email address"><input type="email" className="fw-input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        {user.hasPassword && (
          <Field label="Current password"><input type="password" className="fw-input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        )}
        <button type="submit" className="btn btn-outline" disabled={busy}>Save Email</button>
      </form>
    </Panel>
  );
};

const PasswordPanel = ({ showToast }) => {
  const { setSession } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, run] = useRunner(showToast);

  const save = (event) => {
    event.preventDefault();
    run(() => account.changePassword(current, next), (res) => {
      setSession(res);
      setCurrent('');
      setNext('');
    });
  };

  return (
    <Panel title="Password" description="Changing it signs out your other devices.">
      <form onSubmit={save} className="fw-form">
        <Field label="Current password"><input type="password" className="fw-input" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
        <Field label="New password"><input type="password" className="fw-input" autoComplete="new-password" minLength={6} value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
        <button type="submit" className="btn btn-outline" disabled={busy}>Change Password</button>
      </form>
    </Panel>
  );
};

const TwoFactorPanel = ({ showToast }) => {
  const { user, updateUserData } = useAuth();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [busy, run] = useRunner(showToast);

  const enable = (event) => {
    event.preventDefault();
    run(() => account.twoFactorEnable(code.trim()), (res) => {
      updateUserData(res.user);
      setRecoveryCodes(res.recoveryCodes);
      setSetup(null);
      setCode('');
    });
  };

  const disable = (event) => {
    event.preventDefault();
    run(() => account.twoFactorDisable(code.trim()), (res) => {
      updateUserData(res.user);
      setCode('');
    });
  };

  const description = user.role !== 'user'
    ? 'Required for staff accounts.'
    : 'Adds a code from an authenticator app, such as Google Authenticator or 1Password, when you sign in.';

  return (
    <Panel title="Two-Factor Authentication" description={description}>
      {recoveryCodes && (
        <div className="fw-callout">
          <strong>Save these recovery codes now.</strong>
          <p>Each works once if you lose your authenticator. You won't see them again.</p>
          <pre className="fw-code">{recoveryCodes.join('\n')}</pre>
          <div className="fw-row">
            <button type="button" className="btn btn-outline" onClick={() => saveText(recoveryCodes.join('\n'), 'feelowall-recovery-codes.txt')}>Download</button>
            <button type="button" className="btn btn-outline" onClick={() => setRecoveryCodes(null)}>I've saved them</button>
          </div>
        </div>
      )}

      {user.twoFactorEnabled ? (
        <>
          <p className="fw-status">Two-factor authentication is on.</p>
          {user.role === 'user' && (
            <form onSubmit={disable} className="fw-form">
              <Field label="Code from your app, or a recovery code"><input className="fw-input" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required /></Field>
              <button type="submit" className="btn btn-outline" disabled={busy}>Turn Off</button>
            </form>
          )}
        </>
      ) : setup ? (
        <form onSubmit={enable} className="fw-form">
          <p>In your authenticator app, add an account using this key:</p>
          <pre className="fw-code">{setup.secret}</pre>
          <p className="fw-field-hint">On a phone, you can <a href={setup.otpauthUrl}>open it in your authenticator app</a>.</p>
          <Field label="Enter the 6-digit code it shows"><input className="fw-input" inputMode="numeric" pattern="\d{6}" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required /></Field>
          <button type="submit" className="btn btn-primary" disabled={busy}>Turn On</button>
        </form>
      ) : (
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => run(account.twoFactorSetup, setSetup)}>Set Up Two-Factor</button>
      )}
    </Panel>
  );
};

const PreferencesPanel = ({ showToast }) => {
  const { user, updateUserData } = useAuth();
  const [muted, setMuted] = useState({ users: [], tags: [] });
  const [newTag, setNewTag] = useState('');
  const [newUser, setNewUser] = useState('');
  const [, run] = useRunner(showToast);

  const load = useCallback(() => account.muted().then(setMuted).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const toggleMature = (event) => {
    const showMature = event.target.checked;
    run(() => account.updatePreferences({ showMature }), (res) => updateUserData(res.user));
  };

  const addTag = (event) => {
    event.preventDefault();
    if (!newTag.trim()) return;
    run(() => account.toggleMuteTag(newTag.trim()), () => { setNewTag(''); load(); });
  };

  const addUser = (event) => {
    event.preventDefault();
    if (!newUser.trim()) return;
    run(() => account.toggleMuteUser(newUser.trim()), () => { setNewUser(''); load(); });
  };

  return (
    <Panel title="Content Preferences" description="Choose what appears in galleries, search, and your feed.">
      <label className="fw-check">
        <input type="checkbox" checked={!!user.showMature} onChange={toggleMature} />
        <span>Show mature content. It's hidden by default.</span>
      </label>

      <h3 className="fw-subhead">Muted tags</h3>
      <div className="fw-chips">
        {muted.tags.length === 0 && <span className="fw-field-hint">None yet.</span>}
        {muted.tags.map((tag) => (
          <button key={tag} type="button" className="fw-chip" onClick={() => run(() => account.toggleMuteTag(tag), load)} aria-label={`Unmute tag ${tag}`}>
            #{tag} <X size={12} aria-hidden="true" />
          </button>
        ))}
      </div>
      <form onSubmit={addTag} className="fw-inline-form">
        <input className="fw-input" aria-label="Tag to mute" placeholder="Tag to mute" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
        <button type="submit" className="btn btn-outline">Mute</button>
      </form>

      <h3 className="fw-subhead">Muted creators</h3>
      <div className="fw-chips">
        {muted.users.length === 0 && <span className="fw-field-hint">None yet.</span>}
        {muted.users.map((name) => (
          <button key={name} type="button" className="fw-chip" onClick={() => run(() => account.toggleMuteUser(name), load)} aria-label={`Unmute ${name}`}>
            {name} <X size={12} aria-hidden="true" />
          </button>
        ))}
      </div>
      <form onSubmit={addUser} className="fw-inline-form">
        <input className="fw-input" aria-label="Username to mute" placeholder="Username to mute" value={newUser} onChange={(e) => setNewUser(e.target.value)} />
        <button type="submit" className="btn btn-outline">Mute</button>
      </form>
    </Panel>
  );
};

const SavedSearchesPanel = ({ showToast }) => {
  const [searches, setSearches] = useState([]);
  const [, run] = useRunner(showToast);
  const load = useCallback(() => discovery.savedSearches().then((res) => setSearches(res.searches)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  return (
    <Panel title="Saved Searches" description="Get a notification when a new wallpaper matches. Save a search from the search page.">
      {searches.length === 0 ? <p className="fw-field-hint">No saved searches yet.</p> : (
        <ul className="fw-list">
          {searches.map((saved) => (
            <li key={saved._id} className="fw-list-row">
              <div>
                <strong>{saved.name}</strong>
                <span className="fw-field-hint">{[saved.search, saved.category, saved.tag && `#${saved.tag}`].filter(Boolean).join(' · ')}</span>
              </div>
              <div className="fw-row">
                <label className="fw-check">
                  <input
                    type="checkbox"
                    checked={saved.alertsEnabled}
                    onChange={(e) => run(() => discovery.updateSavedSearch(saved._id, { alertsEnabled: e.target.checked }), load)}
                  />
                  <span>Alerts</span>
                </label>
                <button type="button" className="fw-icon-button" aria-label={`Delete saved search ${saved.name}`} onClick={() => run(() => discovery.deleteSavedSearch(saved._id), load)}>
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

const DownloadHistoryPanel = ({ showToast }) => {
  const [rows, setRows] = useState(null);
  const [, run] = useRunner(showToast);
  const load = useCallback(() => account.downloads().then((res) => setRows(res.downloads)).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);

  return (
    <Panel title="Download History" description="Only you can see this.">
      {rows && rows.length > 0 && (
        <div className="fw-row fw-spaced">
          <button type="button" className="btn btn-outline" onClick={() => window.confirm('Clear your download history?') && run(account.clearDownloads, load)}>Clear History</button>
        </div>
      )}
      {rows && rows.length === 0 && <p className="fw-field-hint">Nothing here yet.</p>}
      <ul className="fw-list">
        {(rows || []).map((row) => (
          <li key={row.id} className="fw-list-row">
            <Link to={`/wallpaper/${row.wallpaper._id}`} className="fw-media-row">
              <img src={mediaUrl(row.wallpaper.imageUrl)} alt="" loading="lazy" />
              <span>
                <strong>{row.wallpaper.title}</strong>
                <span className="fw-field-hint">by {row.wallpaper.uploadedBy} · {timeAgo(row.downloadedAt)}</span>
              </span>
            </Link>
            <div className="fw-row">
              <Link to={`/wallpaper/${row.wallpaper._id}`} className="fw-icon-button" aria-label={`Download ${row.wallpaper.title} again`}>
                <Download size={15} aria-hidden="true" />
              </Link>
              <button type="button" className="fw-icon-button" aria-label={`Remove ${row.wallpaper.title} from history`} onClick={() => run(() => account.removeDownload(row.id), load)}>
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
};

const DataPanel = ({ showToast }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmUsername, setConfirmUsername] = useState('');
  const [code, setCode] = useState('');
  const [busy, run] = useRunner(showToast);

  const exportData = () => run(async () => {
    const data = await account.exportData();
    saveText(JSON.stringify(data, null, 2), `feelowall-data-${dateOnly(new Date()).replace(/\W+/g, '-')}.json`, 'application/json');
  });

  const remove = (event) => {
    event.preventDefault();
    if (!window.confirm('Permanently delete your account? This can\'t be undone.')) return;
    run(() => account.deleteAccount({ password, confirmUsername, code }), () => {
      logout();
      navigate('/');
    });
  };

  return (
    <>
      <Panel title="Download Your Data" description="A file with your profile, uploads, collections, comments, likes, and purchases.">
        <button type="button" className="btn btn-outline" disabled={busy} onClick={exportData}>Download My Data</button>
      </Panel>

      <Panel danger title="Delete Account">
        <ul className="fw-bullets">
          <li><strong>Deleted:</strong> your profile, uploads and their files, collections, saved searches, notifications, and API keys.</li>
          <li><strong>Anonymised:</strong> your comments stay in their threads as "[deleted]".</li>
          <li><strong>Kept:</strong> payment records, for accounting, with your name removed. Packs that people have bought stay available to those buyers.</li>
        </ul>
        <form onSubmit={remove} className="fw-form">
          {user.hasPassword ? (
            <Field label="Your password"><input type="password" className="fw-input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          ) : (
            <Field label={`Type your username (${user.username}) to confirm`}><input className="fw-input" autoComplete="off" value={confirmUsername} onChange={(e) => setConfirmUsername(e.target.value)} required /></Field>
          )}
          {user.twoFactorEnabled && (
            <Field label="Authentication code"><input className="fw-input" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required /></Field>
          )}
          <button type="submit" className="btn fw-btn-danger" disabled={busy}>Delete My Account</button>
        </form>
      </Panel>
    </>
  );
};

const TABS = [
  { id: 'security', label: 'Account & Security' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'activity', label: 'Searches & Downloads' },
  { id: 'data', label: 'Your Data' }
];

const AccountSettingsPage = ({ showToast }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState('security');

  if (!user) return <Navigate to="/" replace />;

  return (
    <Page title="Account Settings" description={`Signed in as ${user.username}`}>
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'security' && (
        <>
          <EmailPanel showToast={showToast} />
          {user.hasPassword && <PasswordPanel showToast={showToast} />}
          <TwoFactorPanel showToast={showToast} />
        </>
      )}
      {tab === 'preferences' && <PreferencesPanel showToast={showToast} />}
      {tab === 'activity' && (
        <>
          <SavedSearchesPanel showToast={showToast} />
          <DownloadHistoryPanel showToast={showToast} />
        </>
      )}
      {tab === 'data' && <DataPanel showToast={showToast} />}
    </Page>
  );
};

export default AccountSettingsPage;
