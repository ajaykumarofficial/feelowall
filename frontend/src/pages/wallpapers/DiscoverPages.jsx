import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Hash, Rss, Sparkles } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { account, API_BASE, discovery, errorMessage } from '../../services/platformService';
import { Empty, Loading, Page, WallpaperCards } from '../../components/ui';

const LoadMore = ({ visible, busy, onClick }) => (visible ? (
  <div className="fw-center">
    <button type="button" className="btn btn-outline" disabled={busy} onClick={onClick}>{busy ? 'Loading...' : 'Load More'}</button>
  </div>
) : null);

export const TagPage = ({ showToast }) => {
  const { tag } = useParams();
  const { user, openAuth, updateUserData } = useAuth();
  const [state, setState] = useState({ wallpapers: null, hasMore: false, page: 1, total: 0 });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (page) => {
    setBusy(true);
    try {
      const res = await discovery.list({ tag, page, limit: 24 });
      setState((current) => ({
        wallpapers: page === 1 ? res.wallpapers : [...(current.wallpapers || []), ...res.wallpapers],
        hasMore: res.hasMore,
        page,
        total: res.total
      }));
    } catch (err) {
      showToast(errorMessage(err), 'error');
      setState((current) => ({ ...current, wallpapers: current.wallpapers || [] }));
    } finally {
      setBusy(false);
    }
  }, [tag, showToast]);

  useEffect(() => { load(1); }, [load]);

  const normalized = tag.toLowerCase();
  const following = !!user?.followedTags?.includes(normalized);

  const toggleFollow = async () => {
    if (!user) {
      openAuth('login');
      return;
    }
    try {
      const res = await account.toggleFollowTag(tag);
      updateUserData({ followedTags: res.tags });
      showToast(res.message, 'success');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  return (
    <Page
      title={`#${tag}`}
      description={state.wallpapers ? `${state.total} ${state.total === 1 ? 'wallpaper' : 'wallpapers'}` : ''}
      actions={(
        <>
          <button type="button" className={`btn ${following ? 'btn-outline' : 'btn-primary'}`} onClick={toggleFollow}>
            {following ? 'Following' : 'Follow Tag'}
          </button>
          <a className="btn btn-outline" href={`${API_BASE}/rss/tag/${encodeURIComponent(tag)}`} target="_blank" rel="noreferrer">
            <Rss size={15} aria-hidden="true" /> RSS
          </a>
        </>
      )}
    >
      {!state.wallpapers && <Loading />}
      {state.wallpapers?.length === 0 && <Empty icon={Hash} title="No wallpapers with this tag yet" />}
      {state.wallpapers?.length > 0 && <WallpaperCards wallpapers={state.wallpapers} />}
      <LoadMore visible={state.hasMore} busy={busy} onClick={() => load(state.page + 1)} />
    </Page>
  );
};

export const ForYouPage = ({ showToast }) => {
  const { user } = useAuth();
  const [state, setState] = useState({ wallpapers: null, hasMore: false, page: 1, personalized: true });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (page) => {
    setBusy(true);
    try {
      const res = await discovery.forYou(page);
      setState((current) => ({
        wallpapers: page === 1 ? res.wallpapers : [...(current.wallpapers || []), ...res.wallpapers],
        hasMore: res.hasMore,
        page,
        personalized: res.personalized
      }));
    } catch (err) {
      showToast(errorMessage(err), 'error');
      setState((current) => ({ ...current, wallpapers: current.wallpapers || [] }));
    } finally {
      setBusy(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user) load(1);
  }, [user?.id, load]);

  if (!user) return <Navigate to="/" replace />;

  return (
    <Page
      title="For You"
      description={state.personalized
        ? 'Picked from what you like and who you follow.'
        : 'Trending right now. Like wallpapers and follow creators to personalize this.'}
    >
      {!state.wallpapers && <Loading />}
      {state.wallpapers?.length === 0 && <Empty icon={Sparkles} title="Nothing to recommend yet">Check back as more wallpapers are added.</Empty>}
      {state.wallpapers?.length > 0 && <WallpaperCards wallpapers={state.wallpapers} />}
      <LoadMore visible={state.hasMore} busy={busy} onClick={() => load(state.page + 1)} />
    </Page>
  );
};
