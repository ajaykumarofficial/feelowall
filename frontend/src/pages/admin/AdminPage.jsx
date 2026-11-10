import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ShieldCheck, Inbox } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { errorMessage, mediaUrl, moderation } from '../../services/platformService';
import { Empty, Loading, Page, Panel, Tabs, dateOnly, timeAgo } from '../../components/ui';

const REASON_LABELS = {
  copyright: 'Copyright',
  nsfw: 'Inappropriate content',
  spam: 'Spam',
  other: 'Other',
  duplicate: 'Possible duplicate',
  'ai-flag': 'Flagged by automated check'
};

const ReportsTab = ({ showToast }) => {
  const [status, setStatus] = useState('open');
  const [reports, setReports] = useState(null);

  const load = useCallback(() => {
    setReports(null);
    moderation.reports(status)
      .then((res) => setReports(res.reports))
      .catch((err) => {
        showToast(errorMessage(err), 'error');
        setReports([]);
      });
  }, [status, showToast]);
  useEffect(() => { load(); }, [load]);

  const act = async (report, action) => {
    if (action === 'remove' && !window.confirm('Remove this for everyone?')) return;
    if (action === 'suspend' && !window.confirm(`Suspend ${report.target?.owner}? They'll be signed out immediately.`)) return;
    try {
      const res = await moderation.resolve(report.id, action);
      showToast(res.message, 'success');
      load();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <div className="fw-row fw-spaced">
        <label className="fw-field-label" htmlFor="reportStatus">Show</label>
        <select id="reportStatus" className="select-dropdown" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      {!reports && <Loading />}
      {reports && reports.length === 0 && <Empty icon={Inbox} title="Nothing to review">Reports appear here, oldest first.</Empty>}
      <ul className="fw-list">
        {(reports || []).map((report) => (
          <li key={report.id} className="fw-report">
            {report.target?.imageUrl && <img src={mediaUrl(report.target.imageUrl)} alt="" loading="lazy" />}
            <div className="fw-report-body">
              <div className="fw-row">
                <span className="badge">{REASON_LABELS[report.reason] || report.reason}</span>
                <span className="fw-field-hint">{report.targetType} · {report.reporter} · {timeAgo(report.createdAt)}</span>
              </div>
              {report.target ? (
                <p>
                  <Link to={report.target.link} className="fw-link"><strong>{report.target.label}</strong></Link>
                  {' '}by {report.target.owner} <span className="fw-field-hint">({report.target.status})</span>
                </p>
              ) : <p className="fw-field-hint">This item no longer exists.</p>}
              {report.details && <p className="fw-quote">{report.details}</p>}
              {report.status === 'open' ? (
                <div className="fw-row">
                  <button type="button" className="btn btn-outline" onClick={() => act(report, 'dismiss')}>Dismiss</button>
                  {report.target && report.targetType !== 'user' && (
                    <>
                      <button type="button" className="btn btn-outline" onClick={() => act(report, 'hide')}>Hide</button>
                      <button type="button" className="btn btn-outline" onClick={() => act(report, 'remove')}>Remove</button>
                    </>
                  )}
                  {report.target && <button type="button" className="btn fw-btn-danger" onClick={() => act(report, 'suspend')}>Suspend User</button>}
                </div>
              ) : <p className="fw-field-hint">Outcome: {report.resolution}</p>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};

const UsersTab = ({ showToast, isAdmin, currentUserId }) => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);

  const search = useCallback((q = '') => {
    moderation.users(q).then((res) => setUsers(res.users)).catch((err) => showToast(errorMessage(err), 'error'));
  }, [showToast]);
  useEffect(() => { search(); }, [search]);

  const apply = async (action) => {
    try {
      const res = await action();
      showToast(res.message, 'success');
      search(query);
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <form className="fw-inline-form" onSubmit={(e) => { e.preventDefault(); search(query); }}>
        <input className="fw-input" aria-label="Search users" placeholder="Search by username" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" className="btn btn-outline">Search</button>
      </form>
      <div className="fw-table-wrap">
        <table className="fw-table">
          <thead>
            <tr><th>User</th><th>Role</th><th>2FA</th><th>Joined</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <Link to={`/creator/${encodeURIComponent(user.username)}`} className="fw-link">{user.username}</Link>
                  {user.status === 'suspended' && <span className="badge fw-badge-danger"> Suspended</span>}
                  {user.isVerified && <span className="badge"> Verified</span>}
                </td>
                <td>
                  {isAdmin && user.id !== currentUserId ? (
                    <select
                      className="select-dropdown"
                      aria-label={`Role for ${user.username}`}
                      value={user.role}
                      onChange={(e) => apply(() => moderation.setRole(user.id, e.target.value))}
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : user.role}
                </td>
                <td>{user.twoFactorEnabled ? 'On' : 'Off'}</td>
                <td>{dateOnly(user.createdAt)}</td>
                <td>
                  <div className="fw-row">
                    {user.id !== currentUserId && user.role === 'user' && (
                      <button type="button" className="fw-link" onClick={() => apply(() => moderation.setSuspended(user.id, user.status !== 'suspended'))}>
                        {user.status === 'suspended' ? 'Lift suspension' : 'Suspend'}
                      </button>
                    )}
                    {isAdmin && (
                      <button type="button" className="fw-link" onClick={() => apply(() => moderation.setVerified(user.id, !user.isVerified))}>
                        {user.isVerified ? 'Remove badge' : 'Verify'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const AdminPage = ({ showToast }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState('reports');
  const [stats, setStats] = useState(null);
  const [blocked, setBlocked] = useState(null);

  const isStaff = user && ['admin', 'moderator'].includes(user.role);

  useEffect(() => {
    if (!isStaff) return;
    moderation.stats().then(setStats).catch((err) => {
      setBlocked(err.response?.data?.code === 'TWO_FACTOR_REQUIRED' ? 'two-factor' : errorMessage(err));
    });
  }, [isStaff]);

  if (!isStaff) return <Navigate to="/" replace />;

  if (blocked) {
    return (
      <Page title="Moderation">
        <Empty icon={ShieldCheck} title="Turn on two-factor authentication">
          {blocked === 'two-factor' ? 'Staff tools need two-factor authentication. ' : `${blocked} `}
          <Link to="/settings" className="fw-link">Go to Account Settings</Link>
        </Empty>
      </Page>
    );
  }

  return (
    <Page title="Moderation" description={`Signed in as ${user.role}`}>
      {stats && (
        <div className="fw-stats">
          <div className="fw-stat"><strong>{stats.openReports}</strong><span>Open reports</span></div>
          <div className="fw-stat"><strong>{stats.users}</strong><span>Users</span></div>
          <div className="fw-stat"><strong>{stats.wallpapers}</strong><span>Wallpapers</span></div>
          <div className="fw-stat"><strong>{stats.suspended}</strong><span>Suspended</span></div>
        </div>
      )}
      <Tabs tabs={[{ id: 'reports', label: 'Reports' }, { id: 'users', label: 'Users' }]} active={tab} onChange={setTab} />
      <Panel>
        {tab === 'reports'
          ? <ReportsTab showToast={showToast} />
          : <UsersTab showToast={showToast} isAdmin={user.role === 'admin'} currentUserId={user.id} />}
      </Panel>
    </Page>
  );
};

export default AdminPage;
