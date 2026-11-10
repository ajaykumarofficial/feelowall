import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { discovery } from '../../services/platformService';

/** Resolution, orientation, and aspect ratio filters for gallery pages. */
export const GalleryFilters = ({ filters, onChange }) => {
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value });
  return (
    <div className="fw-filters">
      <select className="select-dropdown" aria-label="Filter by resolution" value={filters.resolution || ''} onChange={set('resolution')}>
        <option value="">Any resolution</option>
        <option value="1080p">1080p and up</option>
        <option value="1440p">1440p and up</option>
        <option value="4k">4K and up</option>
      </select>
      <select className="select-dropdown" aria-label="Filter by orientation" value={filters.orientation || ''} onChange={set('orientation')}>
        <option value="">Any orientation</option>
        <option value="landscape">Landscape</option>
        <option value="portrait">Portrait</option>
        <option value="square">Square</option>
      </select>
      <select className="select-dropdown" aria-label="Filter by shape" value={filters.aspect || ''} onChange={set('aspect')}>
        <option value="">Any shape</option>
        <option value="widescreen">Widescreen</option>
        <option value="ultrawide">Ultrawide</option>
        <option value="phone">Phone</option>
        <option value="square">Square</option>
      </select>
    </div>
  );
};

/**
 * Tag suggestions under a search box. Attach to any input by rendering this next
 * to it, inside a position: relative wrapper.
 */
export const TagSuggestions = ({ query, onChoose }) => {
  const navigate = useNavigate();
  const listId = useId();
  const [tags, setTags] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const latest = useRef('');

  useEffect(() => {
    setDismissed(false);
    const text = String(query || '').trim();
    latest.current = text;
    if (text.length < 2) {
      setTags([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      discovery.tags(text, 6)
        .then((res) => {
          if (latest.current === text) setTags(res.tags);
        })
        .catch(() => setTags([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  if (!tags.length || dismissed) return null;

  return (
    <ul className="fw-suggest" id={listId} aria-label="Tag suggestions">
      {tags.map(({ tag, count }) => (
        <li key={tag}>
          <button
            type="button"
            // mousedown fires before the input loses focus, so the list is still there to click.
            onMouseDown={(event) => {
              event.preventDefault();
              setDismissed(true);
              if (onChoose) onChoose(tag);
              navigate(`/tags/${encodeURIComponent(tag)}`);
            }}
          >
            <span>#{tag}</span>
            <span className="fw-field-hint">{count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
};
