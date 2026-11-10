import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Banknote, FileImage, Layers, Package, Trash2, X } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import wallpaperService from '../../services/wallpaperService';
import { errorMessage, mediaUrl, packs as packsApi, payments, studio } from '../../services/platformService';
import { Empty, Field, Loading, Page, Panel, Tabs, dateOnly, dateTime, money, toLocalInput } from '../../components/ui';
import AnalyticsCharts from './AnalyticsCharts';

const STATUS_LABELS = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  hidden: 'Hidden by moderators',
  'pack-only': 'In a paid pack'
};

const statusOf = (wallpaper) => wallpaper.status || 'published';

const imageSize = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    resolve({ width: image.naturalWidth, height: image.naturalHeight });
    URL.revokeObjectURL(url);
  };
  image.onerror = () => {
    resolve({ width: null, height: null });
    URL.revokeObjectURL(url);
  };
  image.src = url;
});

const ScheduleForm = ({ wallpaper, onDone, showToast }) => {
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 86400000)));
  const submit = async (event) => {
    event.preventDefault();
    try {
      await studio.setPublish(wallpaper._id, 'scheduled', new Date(when).toISOString());
      showToast('Wallpaper scheduled.', 'success');
      onDone();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };
  return (
    <form onSubmit={submit} className="fw-inline-form">
      <input type="datetime-local" className="fw-input" aria-label="Publish time" min={toLocalInput(new Date())} value={when} onChange={(e) => setWhen(e.target.value)} required />
      <button type="submit" className="btn btn-primary">Schedule</button>
    </form>
  );
};

const VARIANT_OPTIONS = [
  ['desktop', 'Desktop'], ['mobile', 'Mobile'], ['tablet', 'Tablet'], ['ultrawide', 'Ultrawide'], ['light', 'Light theme'], ['dark', 'Dark theme']
];

const VariantsEditor = ({ wallpaper, onChange, showToast }) => {
  const [label, setLabel] = useState('mobile');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const used = new Set((wallpaper.variants || []).map((variant) => variant.label));
  const options = VARIANT_OPTIONS.filter(([value]) => !used.has(value));
  const selected = used.has(label) ? options[0]?.[0] : label;

  const upload = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const { width, height } = await imageSize(file);
      const { url, publicId } = await wallpaperService.uploadFile(file);
      await studio.addVariant(wallpaper._id, { label: selected, imageUrl: url, filename: publicId, width, height });
      showToast('Variant added.', 'success');
      onChange();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (variantId) => {
    try {
      await studio.removeVariant(wallpaper._id, variantId);
      onChange();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="fw-subpanel">
      <h4 className="fw-subhead">Variants</h4>
      <p className="fw-field-hint">Other versions of this artwork. "Download for My Device" picks the best fit automatically.</p>
      <div className="fw-chips">
        {(wallpaper.variants || []).map((variant) => (
          <button key={variant._id} type="button" className="fw-chip" onClick={() => remove(variant._id)} aria-label={`Remove ${variant.label} variant`}>
            {variant.label}{variant.width ? ` (${variant.width}×${variant.height})` : ''} <X size={12} aria-hidden="true" />
          </button>
        ))}
      </div>
      {options.length > 0 && (
        <div className="fw-inline-form">
          <select className="select-dropdown" aria-label="Variant type" value={selected} onChange={(e) => setLabel(e.target.value)}>
            {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
          <input ref={inputRef} type="file" accept="image/*" className="fw-sr-only" aria-label="Variant image" tabIndex={-1} onChange={upload} />
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? 'Uploading...' : 'Upload Variant'}</button>
        </div>
      )}
    </div>
  );
};

const WallpaperAnalytics = ({ wallpaperId }) => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    studio.analytics(wallpaperId, days).then(setData).catch(() => setData(false));
  }, [wallpaperId, days]);

  if (data === false) return <p className="fw-field-hint">Couldn't load analytics.</p>;
  if (!data) return <Loading />;

  return (
    <div className="fw-subpanel">
      <div className="fw-row fw-between">
        <h4 className="fw-subhead">Performance</h4>
        <select className="select-dropdown" aria-label="Time range" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      <div className="fw-stats">
        <div className="fw-stat"><strong>{data.totals.views.toLocaleString()}</strong><span>All-time views</span></div>
        <div className="fw-stat"><strong>{data.totals.downloads.toLocaleString()}</strong><span>All-time downloads</span></div>
        <div className="fw-stat"><strong>{data.totals.likes.toLocaleString()}</strong><span>All-time likes</span></div>
        <div className="fw-stat"><strong>{data.period.downloadRate}%</strong><span>Download rate, this period</span></div>
      </div>
      <AnalyticsCharts series={data.series} />
    </div>
  );
};

const ContentTab = ({ showToast }) => {
  const [filter, setFilter] = useState('');
  const [wallpapers, setWallpapers] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(() => {
    studio.mine(filter).then((res) => setWallpapers(res.wallpapers)).catch(() => setWallpapers([]));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (wallpaper, status) => {
    try {
      const res = await studio.setPublish(wallpaper._id, status);
      showToast(res.message, 'success');
      load();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const toggle = (id, panel) => setExpanded((current) => (current?.id === id && current.panel === panel ? null : { id, panel }));

  return (
    <>
      <div className="fw-row fw-spaced">
        <label className="fw-field-label" htmlFor="studioFilter">Show</label>
        <select id="studioFilter" className="select-dropdown" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Everything</option>
          <option value="draft">Drafts</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
          <option value="hidden">Hidden</option>
          <option value="pack-only">In packs</option>
        </select>
      </div>
      {!wallpapers && <Loading />}
      {wallpapers?.length === 0 && <Empty icon={FileImage} title="Nothing here yet">Upload a wallpaper from the profile menu, and save it as a draft or schedule it.</Empty>}
      <ul className="fw-list">
        {(wallpapers || []).map((wallpaper) => {
          const status = statusOf(wallpaper);
          const editable = ['draft', 'scheduled', 'published'].includes(status);
          const open = expanded?.id === wallpaper._id ? expanded.panel : null;
          return (
            <li key={wallpaper._id} className="fw-studio-item">
              <div className="fw-list-row">
                <Link to={`/wallpaper/${wallpaper._id}`} className="fw-media-row">
                  <img src={mediaUrl(wallpaper.imageUrl)} alt="" loading="lazy" />
                  <span>
                    <strong>{wallpaper.title}</strong>
                    <span className="fw-field-hint">
                      {STATUS_LABELS[status]}
                      {status === 'scheduled' && ` for ${dateTime(wallpaper.scheduledAt)}`}
                      {status === 'published' && ` · ${(wallpaper.viewsCount || 0).toLocaleString()} views · ${(wallpaper.downloadsCount || 0).toLocaleString()} downloads`}
                      {wallpaper.duplicateOf && ' · Under review as a possible duplicate'}
                    </span>
                  </span>
                </Link>
                <div className="fw-row">
                  {status !== 'published' && editable && <button type="button" className="fw-link" onClick={() => setStatus(wallpaper, 'published')}>Publish now</button>}
                  {editable && status !== 'draft' && <button type="button" className="fw-link" onClick={() => setStatus(wallpaper, 'draft')}>Move to drafts</button>}
                  {editable && <button type="button" className="fw-link" onClick={() => toggle(wallpaper._id, 'schedule')}>Schedule</button>}
                  <button type="button" className="fw-link" onClick={() => toggle(wallpaper._id, 'variants')}>Variants</button>
                  <button type="button" className="fw-link" onClick={() => toggle(wallpaper._id, 'analytics')}>Analytics</button>
                </div>
              </div>
              {open === 'schedule' && <ScheduleForm wallpaper={wallpaper} showToast={showToast} onDone={() => { setExpanded(null); load(); }} />}
              {open === 'variants' && <VariantsEditor wallpaper={wallpaper} showToast={showToast} onChange={load} />}
              {open === 'analytics' && <WallpaperAnalytics wallpaperId={wallpaper._id} />}
            </li>
          );
        })}
      </ul>
    </>
  );
};

const EarningsTab = ({ showToast }) => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    payments.connectStatus().then(setStatus).catch(() => setStatus({ paymentsAvailable: false }));
    payments.earnings().then(setEarnings).catch(() => setEarnings({ totals: {}, payments: [] }));
  }, []);

  useEffect(() => {
    // Back from Stripe: the webhook may not have arrived yet, so ask directly.
    if (params.get('stripe')) {
      payments.refresh().catch(() => {}).finally(() => {
        const next = new URLSearchParams(params);
        next.delete('stripe');
        setParams(next, { replace: true });
        load();
      });
    } else {
      load();
    }
  }, []);

  const go = async (action) => {
    setBusy(true);
    try {
      const { url } = await action();
      window.location.assign(url);
    } catch (err) {
      showToast(errorMessage(err), 'error');
      setBusy(false);
    }
  };

  if (!status || !earnings) return <Loading />;
  const { totals } = earnings;

  return (
    <>
      <Panel title="Payouts">
        {!status.paymentsAvailable ? (
          <p className="fw-field-hint">Payments aren't set up on this server yet.</p>
        ) : !status.emailVerified ? (
          <p>Confirm your email address first, in <Link to="/settings" className="fw-link">Account Settings</Link>.</p>
        ) : status.chargesEnabled ? (
          <div className="fw-row fw-between">
            <p className="fw-status">Payouts are active. People can tip you and buy your packs.</p>
            <button type="button" className="btn btn-outline" disabled={busy} onClick={() => go(payments.dashboard)}>Open Stripe Dashboard</button>
          </div>
        ) : (
          <div className="fw-row fw-between">
            <p>{status.connected ? 'Stripe still needs a few details from you.' : 'Connect a Stripe account to receive tips and sell packs.'}</p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => go(payments.onboard)}>
              {status.connected ? 'Continue Setup' : 'Set Up Payouts'}
            </button>
          </div>
        )}
      </Panel>

      <div className="fw-stats">
        <div className="fw-stat"><strong>{money(totals.netCents)}</strong><span>Your earnings</span></div>
        <div className="fw-stat"><strong>{money(totals.grossCents)}</strong><span>Total sales</span></div>
        <div className="fw-stat"><strong>{totals.tips || 0}</strong><span>Tips</span></div>
        <div className="fw-stat"><strong>{totals.packSales || 0}</strong><span>Pack sales</span></div>
        <div className="fw-stat"><strong>{money(totals.refundedCents)}</strong><span>Refunded</span></div>
      </div>

      {earnings.payments.length === 0 ? <Empty icon={Banknote} title="No earnings yet" /> : (
        <div className="fw-table-wrap">
          <table className="fw-table">
            <thead>
              <tr><th scope="col">Date</th><th scope="col">For</th><th scope="col">Status</th><th scope="col" className="fw-num">Amount</th><th scope="col" className="fw-num">Fee</th></tr>
            </thead>
            <tbody>
              {earnings.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{dateOnly(payment.date)}</td>
                  <td>{payment.type === 'tip' ? 'Tip' : payment.packTitle || 'Pack'}</td>
                  <td>{payment.status === 'refunded' ? 'Refunded' : 'Paid'}</td>
                  <td className="fw-num">{money(payment.amountCents, payment.currency)}</td>
                  <td className="fw-num">{money(payment.platformFeeCents, payment.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

const PacksTab = ({ showToast }) => {
  const [packs, setPacks] = useState(null);
  const [wallpapers, setWallpapers] = useState([]);
  const [fields, setFields] = useState({ title: '', description: '', price: '5' });
  const [selected, setSelected] = useState([]);
  const [cover, setCover] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    packsApi.mine().then((res) => setPacks(res.packs)).catch(() => setPacks([]));
    studio.mine().then((res) => setWallpapers(res.wallpapers.filter((wp) => ['draft', 'published'].includes(statusOf(wp))))).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleItem = (id) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const create = async (event) => {
    event.preventDefault();
    if (!selected.length) {
      showToast('Choose at least one wallpaper.', 'error');
      return;
    }
    setBusy(true);
    try {
      let coverUrl = '';
      if (cover) coverUrl = (await wallpaperService.uploadFile(cover)).url;
      const res = await packsApi.create({
        title: fields.title,
        description: fields.description,
        priceCents: Math.round(Number(fields.price) * 100),
        wallpaperIds: selected,
        coverUrl
      });
      showToast(res.message, 'success');
      setFields({ title: '', description: '', price: '5' });
      setSelected([]);
      setCover(null);
      load();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const act = async (action, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      const res = await action();
      showToast(res.message, 'success');
      load();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <Panel title="New Pack" description="Going on sale removes these wallpapers from the public gallery, so buyers get something they can't download for free.">
        <form onSubmit={create} className="fw-form">
          <Field label="Title"><input className="fw-input" maxLength={120} value={fields.title} onChange={(e) => setFields({ ...fields, title: e.target.value })} required /></Field>
          <Field label="Description"><textarea className="fw-input" rows={2} value={fields.description} onChange={(e) => setFields({ ...fields, description: e.target.value })} /></Field>
          <Field label="Price in US dollars ($1 to $1,000)"><input type="number" className="fw-input" min="1" max="1000" step="0.01" value={fields.price} onChange={(e) => setFields({ ...fields, price: e.target.value })} required /></Field>
          <Field label="Cover image (shown to everyone)"><input type="file" accept="image/*" className="fw-input" onChange={(e) => setCover(e.target.files[0] || null)} /></Field>
          <fieldset className="fw-picker">
            <legend className="fw-field-label">Wallpapers ({selected.length} selected)</legend>
            {wallpapers.length === 0 && <p className="fw-field-hint">Upload some wallpapers first.</p>}
            <div className="fw-picker-grid">
              {wallpapers.map((wp) => (
                <label key={wp._id} className={`fw-pick ${selected.includes(wp._id) ? 'active' : ''}`}>
                  <input type="checkbox" className="fw-sr-only" checked={selected.includes(wp._id)} onChange={() => toggleItem(wp._id)} />
                  <img src={mediaUrl(wp.imageUrl)} alt="" loading="lazy" />
                  <span>{wp.title}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="btn btn-primary" disabled={busy}>Save as Draft</button>
        </form>
      </Panel>

      {packs?.length === 0 && <Empty icon={Package} title="No packs yet" />}
      <ul className="fw-list">
        {(packs || []).map((pack) => (
          <li key={pack.id} className="fw-list-row">
            <Link to={`/packs/${pack.id}`} className="fw-media-row">
              {pack.coverUrl ? <img src={mediaUrl(pack.coverUrl)} alt="" loading="lazy" /> : <span className="fw-thumb-blank"><Layers size={18} aria-hidden="true" /></span>}
              <span>
                <strong>{pack.title}</strong>
                <span className="fw-field-hint">{money(pack.priceCents, pack.currency)} · {pack.itemCount} wallpapers · {pack.status}</span>
              </span>
            </Link>
            <div className="fw-row">
              {pack.status !== 'published' && (
                <button type="button" className="fw-link" onClick={() => act(() => packsApi.publish(pack.id), 'Put this pack on sale? Its wallpapers will leave the public gallery.')}>Put on sale</button>
              )}
              {pack.status === 'published' && (
                <button type="button" className="fw-link" onClick={() => act(() => packsApi.unpublish(pack.id))}>Take off sale</button>
              )}
              {pack.status !== 'archived' && (
                <button type="button" className="fw-icon-button" aria-label={`Delete ${pack.title}`} onClick={() => act(() => packsApi.remove(pack.id), 'Delete this pack?')}>
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};

const TABS = [
  { id: 'content', label: 'Content' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'packs', label: 'Packs' }
];

const CreatorStudioPage = ({ showToast }) => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((item) => item.id === params.get('tab')) ? params.get('tab') : 'content';

  if (!user) return <Navigate to="/" replace />;

  return (
    <Page title="Creator Studio" description="Manage drafts, schedules, variants, performance, and earnings.">
      <Tabs tabs={TABS} active={tab} onChange={(next) => setParams({ tab: next })} />
      {tab === 'content' && <Panel><ContentTab showToast={showToast} /></Panel>}
      {tab === 'earnings' && <EarningsTab showToast={showToast} />}
      {tab === 'packs' && <PacksTab showToast={showToast} />}
    </Page>
  );
};

export default CreatorStudioPage;
