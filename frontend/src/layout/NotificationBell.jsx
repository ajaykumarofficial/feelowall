import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { notifications as api } from '../services/platformService';
import { timeAgo } from '../components/ui';
import { useI18n } from '../i18n';

const POLL_MS = 60000;

const NotificationBell = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const containerRef = useRef(null);

  const refreshCount = useCallback(() => {
    if (document.hidden) return;
    api.unreadCount().then((res) => setUnread(res.unreadCount)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = setInterval(refreshCount, POLL_MS);
    document.addEventListener('visibilitychange', refreshCount);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshCount);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const res = await api.list();
        setItems(res.notifications);
        setUnread(res.unreadCount);
      } catch {
        setItems([]);
      }
    }
  };

  const markAllRead = async () => {
    await api.markRead().catch(() => {});
    setUnread(0);
    setItems((current) => current.map((item) => ({ ...item, read: true })));
  };

  const openItem = async (item) => {
    setOpen(false);
    if (!item.read) {
      await api.markRead([item.id]).catch(() => {});
      setUnread((count) => Math.max(count - 1, 0));
      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, read: true } : row)));
    }
    if (item.link) navigate(item.link);
  };

  const label = unread > 0 ? `${t('notifications.open')}, ${t('notifications.unread', { count: unread })}` : t('notifications.open');

  return (
    <div className="fw-bell" ref={containerRef}>
      <button type="button" className="btn-theme-toggle" onClick={toggle} aria-label={label} aria-expanded={open} title={t('notifications.open')}>
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && <span className="fw-bell-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="fw-bell-panel">
          <div className="fw-bell-header">
            <strong>{t('notifications.title')}</strong>
            {unread > 0 && (
              <button type="button" className="fw-link" onClick={markAllRead}>{t('notifications.markAllRead')}</button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="fw-bell-empty">{t('notifications.empty')}</p>
          ) : (
            <ul className="fw-bell-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button type="button" className={`fw-bell-item ${item.read ? '' : 'unread'}`} onClick={() => openItem(item)}>
                    <span>{item.message}</span>
                    <time>{timeAgo(item.updatedAt)}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
