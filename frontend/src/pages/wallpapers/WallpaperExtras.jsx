import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Code2, Coffee, ExternalLink, Flag, Monitor, Palette, VolumeX, X } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { account, API_BASE, errorMessage, moderation, payments, saveText } from '../../services/platformService';
import { Field, licenseLabel } from '../../components/ui';
import { EXPORT_FORMATS } from '../../utils/paletteExport';

const Dialog = ({ title, onClose, children }) => {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X size={20} aria-hidden="true" /></button>
        <h3 className="form-title">{title}</h3>
        {children}
      </div>
    </div>,
    document.body
  );
};

export const ReportDialog = ({ targetType, targetId, label, onClose, showToast }) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await moderation.report(targetType, targetId, reason, details);
      showToast(res.message, 'success');
      onClose();
    } catch (err) {
      showToast(errorMessage(err), 'error');
      setBusy(false);
    }
  };

  return (
    <Dialog title={`Report ${label}`} onClose={onClose}>
      <form onSubmit={submit} className="fw-form">
        <Field label="What's wrong?">
          <select className="fw-input" value={reason} onChange={(e) => setReason(e.target.value)} required>
            <option value="" disabled>Choose a reason</option>
            <option value="copyright">Copyright: this is someone else's work</option>
            <option value="nsfw">Inappropriate or adult content</option>
            <option value="spam">Spam</option>
            <option value="other">Something else</option>
          </select>
        </Field>
        <Field label="Details (optional)">
          <textarea className="fw-input" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={busy}>Send Report</button>
      </form>
    </Dialog>
  );
};

/** Report and mute, for anyone signed in looking at someone else's work. */
export const SafetyActions = ({ targetType, targetId, label, username, showToast }) => {
  const { user, openAuth } = useAuth();
  const [reporting, setReporting] = useState(false);

  const openReport = () => (user ? setReporting(true) : openAuth('login'));
  const mute = async () => {
    if (!user) {
      openAuth('login');
      return;
    }
    if (!window.confirm(`Mute ${username}? Their wallpapers won't appear in your galleries. You can undo this in Account Settings.`)) return;
    try {
      const res = await account.toggleMuteUser(username);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <div className="fw-row">
        <button type="button" className="fw-link fw-muted" onClick={openReport}><Flag size={13} aria-hidden="true" /> Report</button>
        {username && <button type="button" className="fw-link fw-muted" onClick={mute}><VolumeX size={13} aria-hidden="true" /> Mute creator</button>}
      </div>
      {reporting && <ReportDialog targetType={targetType} targetId={targetId} label={label} showToast={showToast} onClose={() => setReporting(false)} />}
    </>
  );
};

const TIP_OPTIONS = [300, 500, 1000, 2000];

export const TipButton = ({ username, showToast, label = 'Send a Tip' }) => {
  const { user, openAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [dollars, setDollars] = useState('5');
  const [busy, setBusy] = useState(false);

  const start = () => (user ? setOpen(true) : openAuth('login'));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await payments.tip(username, Math.round(Number(dollars) * 100));
      window.location.assign(res.url);
    } catch (err) {
      showToast(errorMessage(err), 'error');
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-outline fw-tip" onClick={start}><Coffee size={15} aria-hidden="true" /> {label}</button>
      {open && (
        <Dialog title={`Tip ${username}`} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="fw-form">
            <div className="fw-chips">
              {TIP_OPTIONS.map((cents) => (
                <button key={cents} type="button" className={`fw-chip ${Number(dollars) * 100 === cents ? 'active' : ''}`} onClick={() => setDollars(String(cents / 100))}>
                  ${cents / 100}
                </button>
              ))}
            </div>
            <Field label="Amount in US dollars ($1 to $500)">
              <input type="number" className="fw-input" min="1" max="500" step="1" value={dollars} onChange={(e) => setDollars(e.target.value)} required />
            </Field>
            <p className="fw-field-hint">You'll pay securely on Stripe's checkout page.</p>
            <button type="submit" className="btn btn-primary" disabled={busy}>Continue to Payment</button>
          </form>
        </Dialog>
      )}
    </>
  );
};

export const TagList = ({ tags }) => (tags?.length ? (
  <div className="fw-chips">
    {tags.map((tag) => (
      <Link key={tag} to={`/tags/${encodeURIComponent(String(tag).toLowerCase())}`} className="fw-chip">#{tag}</Link>
    ))}
  </div>
) : null);

export const LicenseInfo = ({ wallpaper }) => (
  <dl className="fw-meta">
    <div>
      <dt>License</dt>
      <dd>{licenseLabel(wallpaper.license)}</dd>
    </div>
    {wallpaper.width && wallpaper.height && (
      <div>
        <dt>Size</dt>
        <dd>{wallpaper.width} × {wallpaper.height}</dd>
      </div>
    )}
    {wallpaper.sourceUrl && /^https?:\/\//i.test(wallpaper.sourceUrl) && (
      <div>
        <dt>Source</dt>
        <dd><a href={wallpaper.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="fw-link">Original source <ExternalLink size={12} aria-hidden="true" /></a></dd>
      </div>
    )}
  </dl>
);

/** Copy-paste embed code, for a wallpaper or a collection. */
export const EmbedButton = ({ path, title, showToast }) => {
  const [open, setOpen] = useState(false);
  const code = `<iframe src="${API_BASE}/embed/${path}" title="${String(title).replace(/"/g, '&quot;')}" width="640" height="400" style="border:0" loading="lazy"></iframe>`;

  const copy = () => navigator.clipboard.writeText(code).then(
    () => showToast('Embed code copied.', 'success'),
    () => showToast('Could not copy. Select the text and copy it.', 'error')
  );

  return (
    <>
      <button type="button" className="btn btn-outline" onClick={() => setOpen(true)}><Code2 size={15} aria-hidden="true" /> <span>Embed</span></button>
      {open && (
        <Dialog title="Embed on Your Site" onClose={() => setOpen(false)}>
          <pre className="fw-code fw-code-wrap">{code}</pre>
          <button type="button" className="btn btn-primary" onClick={copy}>Copy Code</button>
        </Dialog>
      )}
    </>
  );
};

const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'wallpaper';

/** Export the palette as a theme file, plus a link to the multi-monitor tool. */
export const ImageTools = ({ wallpaper, palette, showToast }) => {
  const navigate = useNavigate();
  const colors = palette?.length ? palette : (wallpaper.colors || []);
  const id = wallpaper._id || wallpaper.id;

  const exportTheme = (format) => {
    saveText(format.build(colors, wallpaper.title), `${slug(wallpaper.title)}-${format.id}.${format.extension}`);
    showToast(`${format.label} downloaded.`, 'success');
  };

  return (
    <div className="fw-tools">
      <button type="button" className="btn btn-outline fw-wide" onClick={() => navigate(`/tools/multi-monitor?wallpaper=${id}`)}>
        <Monitor size={16} aria-hidden="true" /> Span Across Monitors
      </button>
      {colors.length > 0 && (
        <div>
          <h4 className="fw-subhead"><Palette size={14} aria-hidden="true" /> Export Colors as a Theme</h4>
          <div className="fw-row">
            {EXPORT_FORMATS.map((format) => (
              <button key={format.id} type="button" className="fw-chip" onClick={() => exportTheme(format)}>{format.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
