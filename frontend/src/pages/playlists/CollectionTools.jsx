import React, { useEffect, useRef, useState } from 'react';
import { Clock, Download, Sun } from 'lucide-react';
import { collections, errorMessage, mediaUrl, saveBlob } from '../../services/platformService';
import { EmbedButton } from '../wallpapers/WallpaperExtras';
import { Field, Panel } from '../../components/ui';
import SlideshowMode from '../wallpapers/SlideshowMode';

const SLOTS = [
  ['dawn', 'Dawn (5am to 8am)'],
  ['day', 'Day (8am to 5pm)'],
  ['dusk', 'Dusk (5pm to 8pm)'],
  ['night', 'Night (8pm to 5am)']
];

const hasAnySlot = (slots) => SLOTS.some(([slot]) => slots?.[slot]);

/** Slideshow that shows the wallpaper for the current part of the viewer's day. */
export const TimeOfDayFrame = ({ playlistId, onClose }) => {
  const [wallpaper, setWallpaper] = useState(null);

  useEffect(() => {
    const refresh = () => collections.current(playlistId, new Date().getHours())
      .then((res) => setWallpaper(res.wallpaper))
      .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [playlistId]);

  if (!wallpaper) return null;
  return <SlideshowMode key={wallpaper._id} wallpapers={[wallpaper]} onClose={onClose} />;
};

const TimeSlotsEditor = ({ playlist, onSaved, showToast }) => {
  const initial = () => Object.fromEntries(SLOTS.map(([slot]) => [slot, playlist.timeSlots?.[slot] ? String(playlist.timeSlots[slot]) : '']));
  const [slots, setSlots] = useState(initial);
  const [busy, setBusy] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await collections.setTimeSlots(playlist._id, slots);
      showToast(res.message, 'success');
      onSaved();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Time-of-Day Set" description="Show a different wallpaper as the day goes on, in Slideshow Mode and the desktop client. Times follow the viewer's clock.">
      <form onSubmit={save} className="fw-form">
        <div className="fw-grid-2">
          {SLOTS.map(([slot, label]) => (
            <Field key={slot} label={label}>
              <select className="fw-input" value={slots[slot]} onChange={(e) => setSlots({ ...slots, [slot]: e.target.value })}>
                <option value="">None</option>
                {playlist.wallpapers.map((wp) => <option key={wp._id} value={wp._id}>{wp.title}</option>)}
              </select>
            </Field>
          ))}
        </div>
        <button type="submit" className="btn btn-outline" disabled={busy}>Save Set</button>
      </form>
    </Panel>
  );
};

/** ZIP download, time-of-day playback, and embed, shown in the collection's action bar. */
export const CollectionActions = ({ playlist, showToast, onPlayTimeOfDay }) => {
  const [zipping, setZipping] = useState(false);

  const downloadZip = async () => {
    setZipping(true);
    showToast('Preparing your ZIP. Large collections can take a while.', 'info');
    try {
      const response = await collections.downloadZip(playlist._id);
      saveBlob(response.data, `${String(playlist.name).replace(/[^\w.-]+/g, '-') || 'collection'}.zip`);
    } catch (err) {
      // The request asked for a binary response, so an error body arrives as a Blob too.
      let message = 'Could not create the ZIP. Please try again.';
      if (err.response?.status === 429) message = 'Too many ZIP downloads. Please try again in a few minutes.';
      else if (err.response?.data instanceof Blob) {
        try {
          message = JSON.parse(await err.response.data.text()).message || message;
        } catch {
          // Keep the general message.
        }
      }
      showToast(message, 'error');
    } finally {
      setZipping(false);
    }
  };

  return (
    <>
      {hasAnySlot(playlist.timeSlots) && (
        <button type="button" className="btn btn-outline" onClick={onPlayTimeOfDay}>
          <Sun size={15} aria-hidden="true" /> <span>Play Time-of-Day</span>
        </button>
      )}
      {playlist.wallpapers?.length > 0 && (
        <button type="button" className="btn btn-outline" onClick={downloadZip} disabled={zipping}>
          <Download size={15} aria-hidden="true" /> <span>{zipping ? 'Preparing...' : 'Download ZIP'}</span>
        </button>
      )}
      {playlist.isPublic && <EmbedButton path={`playlist/${playlist._id}`} title={playlist.name} showToast={showToast} />}
    </>
  );
};

/** Drag to reorder, or use the arrow buttons from a keyboard. Choose a cover here too. */
export const ArrangeCollection = ({ playlist, onChanged, showToast }) => {
  const [items, setItems] = useState(playlist.wallpapers || []);
  const [coverId, setCoverId] = useState(playlist.coverWallpaperId ? String(playlist.coverWallpaperId) : '');
  const dragIndex = useRef(null);

  useEffect(() => {
    setItems(playlist.wallpapers || []);
    setCoverId(playlist.coverWallpaperId ? String(playlist.coverWallpaperId) : '');
  }, [playlist]);

  const move = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const save = async () => {
    try {
      const res = await collections.reorder(playlist._id, items.map((wp) => wp._id));
      showToast(res.message, 'success');
      onChanged();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const chooseCover = async (id) => {
    const next = coverId === id ? '' : id;
    try {
      await collections.setCover(playlist._id, next || null);
      setCoverId(next);
      showToast(next ? 'Cover updated.' : 'Cover removed.', 'success');
      onChanged();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <Panel title="Arrange" description="Drag wallpapers into order, or use the arrows. Slideshow Mode follows this order.">
        <ol className="fw-arrange">
          {items.map((wp, index) => (
            <li
              key={wp._id}
              draggable
              onDragStart={() => { dragIndex.current = index; }}
              onDragOver={(event) => {
                event.preventDefault();
                if (dragIndex.current !== null && dragIndex.current !== index) {
                  move(dragIndex.current, index);
                  dragIndex.current = index;
                }
              }}
              onDragEnd={() => { dragIndex.current = null; }}
            >
              <img src={mediaUrl(wp.imageUrl)} alt="" loading="lazy" />
              <span className="fw-arrange-title">{wp.title}</span>
              <div className="fw-row">
                <button type="button" className={`fw-chip ${coverId === wp._id ? 'active' : ''}`} aria-pressed={coverId === wp._id} onClick={() => chooseCover(wp._id)}>Cover</button>
                <button type="button" className="fw-icon-button" aria-label={`Move ${wp.title} earlier`} disabled={index === 0} onClick={() => move(index, index - 1)}>↑</button>
                <button type="button" className="fw-icon-button" aria-label={`Move ${wp.title} later`} disabled={index === items.length - 1} onClick={() => move(index, index + 1)}>↓</button>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-primary" onClick={save}>Save Order</button>
      </Panel>
      <TimeSlotsEditor playlist={playlist} onSaved={onChanged} showToast={showToast} />
    </>
  );
};

export const ArrangeToggle = ({ active, onClick }) => (
  <button type="button" className="btn btn-outline" onClick={onClick} aria-expanded={active}>
    <Clock size={15} aria-hidden="true" /> <span>{active ? 'Done Arranging' : 'Arrange & Time-of-Day'}</span>
  </button>
);
