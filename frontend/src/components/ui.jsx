import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import { mediaUrl } from '../services/platformService';

/** Lets a clickable non-button element work from the keyboard. */
export const activatable = (onActivate) => ({
  role: 'link',
  tabIndex: 0,
  onKeyDown: (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate();
    }
  }
});

export const Page = ({ title, description, actions, children }) => (
  <main className="gallery-container fw-page">
    <header className="gallery-header fw-page-header">
      <div>
        <h1 className="section-title">{title}</h1>
        {description && <p className="section-desc">{description}</p>}
      </div>
      {actions && <div className="fw-row">{actions}</div>}
    </header>
    {children}
  </main>
);

export const Loading = ({ label = 'Loading...' }) => (
  <div className="loading-state" role="status">
    <div className="spinner" />
    <p>{label}</p>
  </div>
);

export const Empty = ({ icon: Icon, title, children }) => (
  <div className="empty-state">
    {Icon && <Icon className="empty-icon" size={40} aria-hidden="true" />}
    <h3>{title}</h3>
    {children && <p>{children}</p>}
  </div>
);

export const Panel = ({ title, description, children, danger }) => (
  <section className={`fw-panel ${danger ? 'fw-panel-danger' : ''}`}>
    {title && <h2 className="fw-panel-title">{title}</h2>}
    {description && <p className="fw-panel-desc">{description}</p>}
    {children}
  </section>
);

export const Field = ({ label, hint, children }) => (
  <label className="fw-field">
    <span className="fw-field-label">{label}</span>
    {children}
    {hint && <span className="fw-field-hint">{hint}</span>}
  </label>
);

export const VerifiedBadge = ({ size = 15 }) => (
  <span className="fw-verified" title="Verified creator">
    <BadgeCheck size={size} aria-hidden="true" />
    <span className="fw-sr-only">Verified creator</span>
  </span>
);

export const Tabs = ({ tabs, active, onChange }) => (
  <div className="fw-tabs" role="tablist">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={active === tab.id}
        className={`fw-tab ${active === tab.id ? 'active' : ''}`}
        onClick={() => onChange(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);

/** A plain, accessible grid of wallpaper links. */
export const WallpaperCards = ({ wallpapers, renderExtra }) => {
  const navigate = useNavigate();
  return (
    <div className="wallpaper-grid">
      {wallpapers.map((wp) => {
        const id = wp._id || wp.id;
        const open = () => navigate(`/wallpaper/${id}`);
        return (
          <div key={id} className="wallpaper-card" onClick={open} {...activatable(open)} aria-label={wp.title}>
            <div className="card-img-wrapper">
              <img src={mediaUrl(wp.imageUrl)} alt={wp.altText || wp.title} loading="lazy" />
            </div>
            <div className="card-overlay">
              <h4 className="card-title">{wp.title}</h4>
              {wp.uploadedBy && <span className="card-author">by {wp.uploadedBy}</span>}
              {renderExtra && <div className="card-footer">{renderExtra(wp)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const money = (cents, currency = 'usd') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);

export const dateTime = (value) => (value ? new Date(value).toLocaleString() : '');
export const dateOnly = (value) => (value ? new Date(value).toLocaleDateString() : '');
export const timeAgo = (value) => {
  const seconds = Math.max(Math.round((Date.now() - new Date(value).getTime()) / 1000), 0);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return dateOnly(value);
};

/** Value for <input type="datetime-local">, in the viewer's own time zone. */
export const toLocalInput = (date) => {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

export const LICENSES = [
  { value: 'personal-use', label: 'Personal use only', hint: 'People can use it as a wallpaper, but not share or sell it.' },
  { value: 'cc-by', label: 'CC BY', hint: 'Free to share and adapt, with credit.' },
  { value: 'cc-by-sa', label: 'CC BY-SA', hint: 'Free to share and adapt, with credit and the same license.' },
  { value: 'cc-by-nc', label: 'CC BY-NC', hint: 'Free to share and adapt with credit, non-commercially.' },
  { value: 'cc0', label: 'CC0 (public domain)', hint: 'Free for any use, with no credit needed.' },
  { value: 'all-rights-reserved', label: 'All rights reserved', hint: 'Viewing and personal download only.' }
];

export const licenseLabel = (value) => LICENSES.find((item) => item.value === value)?.label || 'Personal use only';
