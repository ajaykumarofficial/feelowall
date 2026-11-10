import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Monitor, Plus, Trash2 } from 'lucide-react';
import wallpaperService from '../../services/wallpaperService';
import { mediaUrl } from '../../services/platformService';
import { Empty, Loading, Page, Panel } from '../../components/ui';
import { PRESETS, computeMonitorCrops, layoutBounds, validateLayout } from '../../utils/multiMonitor';

const toNumbers = (monitors) => monitors.map((monitor) => ({
  width: Number(monitor.width),
  height: Number(monitor.height),
  x: Number(monitor.x),
  y: Number(monitor.y)
}));

const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'wallpaper';

const NUMBER_FIELDS = [['width', 'Width'], ['height', 'Height'], ['x', 'Left'], ['y', 'Top']];

const MultiMonitorPage = ({ showToast }) => {
  const [params] = useSearchParams();
  const wallpaperId = params.get('wallpaper');
  const [wallpaper, setWallpaper] = useState(null);
  const [status, setStatus] = useState(wallpaperId ? 'loading' : 'none');
  const [monitors, setMonitors] = useState(PRESETS[0].monitors);
  const [image, setImage] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!wallpaperId) return;
    wallpaperService.getWallpaperById(wallpaperId)
      .then((data) => {
        setWallpaper(data);
        setStatus('ready');
      })
      .catch(() => setStatus('missing'));
  }, [wallpaperId]);

  // Loaded with CORS enabled so the canvas can export the result.
  useEffect(() => {
    if (!wallpaper) return undefined;
    let cancelled = false;
    const element = new Image();
    element.crossOrigin = 'anonymous';
    element.onload = () => !cancelled && setImage(element);
    element.onerror = () => !cancelled && setStatus('image-error');
    element.src = mediaUrl(wallpaper.imageUrl);
    return () => {
      cancelled = true;
    };
  }, [wallpaper]);

  const numeric = useMemo(() => toNumbers(monitors), [monitors]);
  const problem = validateLayout(numeric);

  const crops = useMemo(() => (!problem && image
    ? computeMonitorCrops(numeric, image.naturalWidth, image.naturalHeight)
    : null), [problem, image, numeric]);

  // The preview: each monitor's actual crop, drawn where it sits, with a gap between screens.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !crops) return;
    const bounds = layoutBounds(numeric);
    const previewWidth = 900;
    const scale = previewWidth / bounds.width;
    canvas.width = previewWidth;
    canvas.height = Math.ceil(bounds.height * scale);
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    crops.forEach((crop, index) => {
      const monitor = numeric[index];
      const x = (monitor.x - bounds.left) * scale;
      const y = (monitor.y - bounds.top) * scale;
      const inset = 2;
      context.drawImage(image, crop.sx, crop.sy, crop.sWidth, crop.sHeight, x + inset, y + inset, crop.width * scale - inset * 2, crop.height * scale - inset * 2);
    });
  }, [crops, image, numeric]);

  const update = (index, field, value) => {
    setMonitors((current) => current.map((monitor, position) => (position === index ? { ...monitor, [field]: value } : monitor)));
  };

  const addMonitor = () => setMonitors((current) => {
    const bounds = layoutBounds(toNumbers(current));
    return [...current, { width: 1920, height: 1080, x: bounds.left + bounds.width, y: bounds.top }];
  });

  const removeMonitor = (index) => setMonitors((current) => current.filter((_, position) => position !== index));

  const downloadAll = async () => {
    if (!crops) return;
    setDownloading(true);
    try {
      for (const [index, crop] of crops.entries()) {
        const canvas = document.createElement('canvas');
        canvas.width = crop.width;
        canvas.height = crop.height;
        canvas.getContext('2d').drawImage(image, crop.sx, crop.sy, crop.sWidth, crop.sHeight, 0, 0, crop.width, crop.height);
        const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('export failed'))), 'image/png'));
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${slug(wallpaper.title)}-monitor-${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        // Browsers can drop several downloads started at the same instant.
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      wallpaperService.incrementDownloadCount(wallpaper._id).catch(() => {});
      showToast(`Downloaded ${crops.length} ${crops.length === 1 ? 'image' : 'images'}. Your browser may ask to allow multiple downloads.`, 'success');
    } catch {
      showToast('Could not create the images. This image host may not allow it.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  if (status === 'none') {
    return (
      <Page title="Multi-Monitor Tool">
        <Empty icon={Monitor} title="Choose a wallpaper first">
          Open any wallpaper and choose "Span Across Monitors". <Link to="/" className="fw-link">Browse wallpapers</Link>
        </Empty>
      </Page>
    );
  }
  if (status === 'loading') return <Page title="Multi-Monitor Tool"><Loading /></Page>;
  if (status === 'missing') return <Page title="Multi-Monitor Tool"><Empty icon={Monitor} title="Wallpaper not found" /></Page>;

  return (
    <Page title="Span Across Monitors" description={wallpaper ? `"${wallpaper.title}" split into one image per screen.` : ''}>
      <Panel title="Your Monitors" description="Copy the sizes and positions from your system's display settings.">
        <div className="fw-row fw-spaced">
          <select
            className="select-dropdown"
            aria-label="Start from a common layout"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value !== '') setMonitors(PRESETS[Number(e.target.value)].monitors);
              e.target.value = '';
            }}
          >
            <option value="" disabled>Start from a common layout</option>
            {PRESETS.map((preset, index) => <option key={preset.label} value={index}>{preset.label}</option>)}
          </select>
          <button type="button" className="btn btn-outline" onClick={addMonitor} disabled={monitors.length >= 8}><Plus size={15} aria-hidden="true" /> Add Monitor</button>
        </div>
        <div className="fw-table-wrap">
          <table className="fw-table">
            <thead>
              <tr><th scope="col">Monitor</th>{NUMBER_FIELDS.map(([, label]) => <th scope="col" key={label}>{label}</th>)}<th><span className="fw-sr-only">Remove</span></th></tr>
            </thead>
            <tbody>
              {monitors.map((monitor, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={index}>
                  <td>{index + 1}</td>
                  {NUMBER_FIELDS.map(([field, label]) => (
                    <td key={field}>
                      <input
                        type="number"
                        className="fw-input fw-input-small"
                        aria-label={`Monitor ${index + 1} ${label.toLowerCase()}`}
                        value={monitor[field]}
                        onChange={(e) => update(index, field, e.target.value)}
                      />
                    </td>
                  ))}
                  <td>
                    <button type="button" className="fw-icon-button" aria-label={`Remove monitor ${index + 1}`} disabled={monitors.length === 1} onClick={() => removeMonitor(index)}>
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {problem && <p className="fw-error" role="alert">{problem}</p>}
      </Panel>

      <Panel title="Preview">
        {status === 'image-error' ? (
          <p className="fw-error" role="alert">This image couldn't be loaded for editing.</p>
        ) : !image ? <Loading label="Loading image..." /> : (
          <>
            <canvas ref={canvasRef} className="fw-monitor-preview" role="img" aria-label="Preview of the image across your monitors" />
            <button type="button" className="btn btn-primary" disabled={!!problem || downloading} onClick={downloadAll}>
              <Download size={16} aria-hidden="true" /> {downloading ? 'Creating images...' : `Download ${numeric.length} ${numeric.length === 1 ? 'Image' : 'Images'}`}
            </button>
          </>
        )}
      </Panel>
    </Page>
  );
};

export default MultiMonitorPage;
