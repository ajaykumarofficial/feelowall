import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, MessageCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { comments as api, errorMessage } from '../../services/platformService';
import { timeAgo } from '../../components/ui';
import { ReportDialog } from './WallpaperExtras';

const MAX_LENGTH = 1000;

const CommentForm = ({ placeholder, onSubmit, autoFocus, onCancel }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    if (await onSubmit(text.trim())) setText('');
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="fw-comment-form">
      <textarea
        className="fw-input"
        rows={2}
        maxLength={MAX_LENGTH}
        aria-label={placeholder}
        placeholder={placeholder}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="fw-row">
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>Post</button>
        {onCancel && <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
};

const CommentItem = ({ comment, canModerate, onDelete, onReply, onReport, signedIn, currentUserId }) => {
  if (comment.removed) return <p className="fw-comment fw-field-hint">This comment was removed.</p>;
  const canDelete = canModerate || comment.authorId === currentUserId;
  return (
    <div className="fw-comment" id={`comment-${comment.id}`}>
      <div className="fw-row">
        <Link to={`/creator/${encodeURIComponent(comment.authorName)}`} className="fw-link"><strong>{comment.authorName}</strong></Link>
        <time className="fw-field-hint">{timeAgo(comment.createdAt)}</time>
      </div>
      <p className="fw-comment-text">{comment.text}</p>
      {signedIn && (
        <div className="fw-row fw-comment-actions">
          {onReply && <button type="button" className="fw-link" onClick={onReply}>Reply</button>}
          {comment.authorId !== currentUserId && (
            <button type="button" className="fw-link fw-muted" onClick={() => onReport(comment.id)}><Flag size={12} aria-hidden="true" /> Report</button>
          )}
          {canDelete && (
            <button type="button" className="fw-link fw-muted" onClick={() => onDelete(comment.id)}><Trash2 size={12} aria-hidden="true" /> Delete</button>
          )}
        </div>
      )}
    </div>
  );
};

const CommentsSection = ({ wallpaperId, ownerId, showToast }) => {
  const { user, openAuth } = useAuth();
  const [threads, setThreads] = useState([]);
  const [total, setTotal] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [reporting, setReporting] = useState(null);

  const load = useCallback(() => {
    api.list(wallpaperId)
      .then((res) => {
        setThreads(res.comments);
        setTotal(res.total);
      })
      .catch(() => setThreads([]));
  }, [wallpaperId]);
  useEffect(() => { load(); }, [load]);

  const post = async (text, parentId) => {
    try {
      await api.create(wallpaperId, text, parentId);
      setReplyingTo(null);
      load();
      return true;
    } catch (err) {
      showToast(errorMessage(err), 'error');
      return false;
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.remove(id);
      load();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const canModerate = !!user && (user.id === String(ownerId) || ['admin', 'moderator'].includes(user.role));
  const shared = {
    canModerate,
    onDelete: remove,
    onReport: setReporting,
    signedIn: !!user,
    currentUserId: user?.id
  };

  return (
    <section className="fw-comments" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="section-title">
        <MessageCircle size={20} aria-hidden="true" /> {total} {total === 1 ? 'Comment' : 'Comments'}
      </h2>

      {user ? (
        <CommentForm placeholder="Add a comment" onSubmit={(text) => post(text)} />
      ) : (
        <button type="button" className="btn btn-outline" onClick={() => openAuth('login')}>Sign in to comment</button>
      )}

      <div className="fw-comment-list">
        {threads.map((thread) => (
          <div key={thread.id} className="fw-thread">
            <CommentItem comment={thread} {...shared} onReply={thread.removed ? null : () => setReplyingTo(thread.id)} />
            {thread.replies.length > 0 && (
              <div className="fw-replies">
                {thread.replies.map((reply) => (
                  <CommentItem key={reply.id} comment={reply} {...shared} onReply={() => setReplyingTo(thread.id)} />
                ))}
              </div>
            )}
            {replyingTo === thread.id && (
              <div className="fw-replies">
                <CommentForm placeholder={`Reply to ${thread.authorName || 'this thread'}`} autoFocus onSubmit={(text) => post(text, thread.id)} onCancel={() => setReplyingTo(null)} />
              </div>
            )}
          </div>
        ))}
      </div>

      {reporting && (
        <ReportDialog targetType="comment" targetId={reporting} label="this comment" showToast={showToast} onClose={() => setReporting(null)} />
      )}
    </section>
  );
};

export default CommentsSection;
