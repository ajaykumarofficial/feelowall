import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { API_BASE, developer, errorMessage } from '../../services/platformService';
import { Field, Page, Panel, dateOnly, timeAgo } from '../../components/ui';

const BASE = `${API_BASE}/api/public/v1`;

const KeysPanel = ({ showToast }) => {
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState(null);

  const load = useCallback(() => developer.keys().then((res) => setKeys(res.keys)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const create = async (event) => {
    event.preventDefault();
    try {
      const res = await developer.createKey(name);
      setFresh(res.key);
      setName('');
      load();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const revoke = async (key) => {
    if (!window.confirm(`Revoke "${key.name}"? Anything using it will stop working immediately.`)) return;
    try {
      await developer.revokeKey(key.id);
      load();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const copy = () => navigator.clipboard.writeText(fresh).then(
    () => showToast('Key copied.', 'success'),
    () => showToast('Could not copy. Select the text and copy it.', 'error')
  );

  return (
    <Panel title="Your API Keys" description="Keep keys private: anyone with one can make requests as you. Each is limited to 60 requests per minute.">
      {fresh && (
        <div className="fw-callout">
          <strong>Copy this key now. You won't see it again.</strong>
          <pre className="fw-code fw-code-wrap">{fresh}</pre>
          <div className="fw-row">
            <button type="button" className="btn btn-outline" onClick={copy}><Copy size={14} aria-hidden="true" /> Copy</button>
            <button type="button" className="btn btn-outline" onClick={() => setFresh(null)}>Done</button>
          </div>
        </div>
      )}
      <form onSubmit={create} className="fw-inline-form">
        <Field label="Key name"><input className="fw-input" placeholder="e.g. My wallpaper script" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <button type="submit" className="btn btn-primary">Create Key</button>
      </form>
      <ul className="fw-list">
        {keys.map((key) => (
          <li key={key.id} className="fw-list-row">
            <div>
              <strong>{key.name}</strong>
              <span className="fw-field-hint"><code>{key.prefix}…</code> · created {dateOnly(key.createdAt)} · {key.lastUsedAt ? `last used ${timeAgo(key.lastUsedAt)}` : 'never used'}</span>
            </div>
            <button type="button" className="fw-icon-button" aria-label={`Revoke ${key.name}`} onClick={() => revoke(key)}><Trash2 size={15} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
    </Panel>
  );
};

const ENDPOINTS = [
  ['GET /wallpapers', 'Search published wallpapers. Filters: search, category, tag, creator, color, resolution, orientation, aspect, sort, page, limit.'],
  ['GET /wallpapers/{id}', 'One wallpaper.'],
  ['GET /tags', 'Popular tags with counts.'],
  ['GET /collections/{id}', 'A collection and its wallpapers. Private ones work with their owner\'s key.'],
  ['GET /collections/{id}/random', 'A random wallpaper from a collection. Add ?redirect=1 to get the image itself.']
];

const DevelopersPage = ({ showToast }) => {
  const { user, openAuth } = useAuth();

  return (
    <Page title="Developers" description="Build with FeeloWall using a read-only API.">
      {user ? <KeysPanel showToast={showToast} /> : (
        <Panel title="Your API Keys">
          <button type="button" className="btn btn-primary" onClick={() => openAuth('login')}>Sign in to create a key</button>
        </Panel>
      )}

      <Panel title="API Reference">
        <p>Base URL:</p>
        <pre className="fw-code fw-code-wrap">{BASE}</pre>
        <p>Send your key in a header. It's rejected in the URL, because URLs end up in logs.</p>
        <pre className="fw-code fw-code-wrap">{`curl -H "X-API-Key: YOUR_KEY" "${BASE}/wallpapers?tag=space&resolution=4k"`}</pre>
        <div className="fw-table-wrap">
          <table className="fw-table">
            <thead><tr><th scope="col">Endpoint</th><th scope="col">Returns</th></tr></thead>
            <tbody>
              {ENDPOINTS.map(([route, text]) => <tr key={route}><td><code>{route}</code></td><td>{text}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p>
          Full details are in the <a className="fw-link" href={`${BASE}/openapi.json`} target="_blank" rel="noreferrer">OpenAPI document</a>.
          Check each wallpaper's <code>license</code> field before using it.
        </p>
      </Panel>

      <Panel title="Rotate Your Phone's Wallpaper" description="Change your phone's wallpaper from a collection, using this API.">
        <p>You'll need an API key and your collection's ID, which is the last part of its web address. The address to use is:</p>
        <pre className="fw-code fw-code-wrap">{`${BASE}/collections/COLLECTION_ID/random?redirect=1`}</pre>
        <h3 className="fw-subhead">iPhone or iPad (Shortcuts)</h3>
        <ol className="fw-bullets">
          <li>Create a shortcut with a <strong>Get Contents of URL</strong> action using that address. Under Headers, add <code>X-API-Key</code> with your key.</li>
          <li>Add a <strong>Set Wallpaper</strong> action, and turn off "Show Preview".</li>
          <li>In the Automation tab, add a <strong>Time of Day</strong> automation that runs the shortcut, and set it to run immediately.</li>
        </ol>
        <h3 className="fw-subhead">Android (MacroDroid or Tasker)</h3>
        <ol className="fw-bullets">
          <li>Create a macro with a daily or hourly <strong>Time</strong> trigger.</li>
          <li>Add an <strong>HTTP Request</strong> action using that address, with the <code>X-API-Key</code> header, saving the response to a file.</li>
          <li>Add a <strong>Set Wallpaper</strong> action that uses the saved file.</li>
        </ol>
        <p className="fw-field-hint">Menu names can differ between app versions. The key stays in your phone's automation, so don't share the shortcut with it inside.</p>
      </Panel>
    </Page>
  );
};

export default DevelopersPage;
