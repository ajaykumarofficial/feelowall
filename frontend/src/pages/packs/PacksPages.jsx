import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Download, Layers, Package } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { errorMessage, mediaUrl, packs as api } from '../../services/platformService';
import { Empty, Loading, Page, Panel, money } from '../../components/ui';

const PackCard = ({ pack }) => (
  <Link to={`/packs/${pack.id}`} className="fw-card fw-pack-card">
    {pack.coverUrl
      ? <img src={mediaUrl(pack.coverUrl)} alt="" loading="lazy" />
      : <span className="fw-pack-blank"><Layers size={32} aria-hidden="true" /></span>}
    <h2>{pack.title}</h2>
    <span className="fw-field-hint">by {pack.creatorName} · {pack.itemCount} {pack.itemCount === 1 ? 'wallpaper' : 'wallpapers'}</span>
    <strong>{money(pack.priceCents, pack.currency)}</strong>
  </Link>
);

export const PacksPage = () => {
  const { user } = useAuth();
  const [packs, setPacks] = useState(null);
  const [purchased, setPurchased] = useState([]);

  useEffect(() => {
    api.list().then((res) => setPacks(res.packs)).catch(() => setPacks([]));
    if (user) api.purchased().then((res) => setPurchased(res.packs)).catch(() => {});
  }, [user?.id]);

  return (
    <Page title="Wallpaper Packs" description="Themed sets you can buy directly from their creators.">
      {purchased.length > 0 && (
        <>
          <h2 className="fw-subhead">Your Purchases</h2>
          <div className="fw-card-grid fw-spaced">{purchased.map((pack) => <PackCard key={pack.id} pack={pack} />)}</div>
          <h2 className="fw-subhead">All Packs</h2>
        </>
      )}
      {!packs && <Loading />}
      {packs?.length === 0 && <Empty icon={Package} title="No packs for sale yet">Creators can make one in Creator Studio.</Empty>}
      <div className="fw-card-grid">{(packs || []).map((pack) => <PackCard key={pack.id} pack={pack} />)}</div>
    </Page>
  );
};

export const PackDetailPage = ({ showToast }) => {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { user, openAuth } = useAuth();
  const [detail, setDetail] = useState(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(id).then(setDetail).catch(() => setMissing(true));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Stripe confirms payment by webhook, which can land a moment after the buyer returns.
  useEffect(() => {
    if (params.get('purchase') !== 'thanks') return undefined;
    showToast('Thanks for your purchase! Your download will be ready in a moment.', 'success');
    setParams({}, { replace: true });
    const timers = [2000, 5000, 10000].map((delay) => setTimeout(load, delay));
    return () => timers.forEach(clearTimeout);
  }, []);

  if (missing) return <Page title="Pack"><Empty icon={Package} title="Pack not found" /></Page>;
  if (!detail) return <Page title="Pack"><Loading /></Page>;

  const { pack, isCreator, purchased } = detail;

  const buy = async () => {
    if (!user) {
      openAuth('login');
      return;
    }
    setBusy(true);
    try {
      const { url } = await api.checkout(pack.id);
      window.location.assign(url);
    } catch (err) {
      showToast(errorMessage(err), 'error');
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const { url } = await api.downloadLink(pack.id);
      window.location.assign(url);
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={pack.title} description={`by ${pack.creatorName}`}>
      <Panel>
        <div className="fw-pack-summary">
          {pack.coverUrl && <img src={mediaUrl(pack.coverUrl)} alt="" />}
          <div>
            {pack.description && <p>{pack.description}</p>}
            <p className="fw-pack-price">{money(pack.priceCents, pack.currency)}</p>
            {isCreator || purchased ? (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={download}>
                <Download size={16} aria-hidden="true" /> Download All (ZIP)
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={buy}>Buy Pack</button>
                <p className="fw-field-hint">You'll pay securely on Stripe's checkout page. Download links expire after 15 minutes, and you can get a new one any time.</p>
              </>
            )}
            {isCreator && <p className="fw-field-hint">This is your pack ({pack.status}). <Link className="fw-link" to="/studio?tab=packs">Manage it</Link></p>}
          </div>
        </div>
      </Panel>

      <h2 className="fw-subhead">{pack.items.length} {pack.items.length === 1 ? 'Wallpaper' : 'Wallpapers'}</h2>
      {isCreator || purchased ? (
        <div className="wallpaper-grid">
          {pack.items.map((item) => (
            <div key={item._id} className="fw-entry">
              <img src={mediaUrl(item.imageUrl)} alt={item.altText || item.title} loading="lazy" />
              <div className="fw-entry-body"><strong>{item.title}</strong></div>
            </div>
          ))}
        </div>
      ) : (
        <ul className="fw-bullets">{pack.items.map((item) => <li key={item._id}>{item.title}</li>)}</ul>
      )}
    </Page>
  );
};
