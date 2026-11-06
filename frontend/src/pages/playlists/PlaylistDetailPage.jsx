import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import playlistService from '../../services/playlistService';
import { Folder, Heart, Lock, Globe, Share2, Trash2, ArrowLeft, Edit3, X, UserPlus, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 15 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -15 }
};

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.25
};

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const PlaylistDetailPage = ({ playlistId, onBack, onZoom, onLike, showToast, onStartSlideshow }) => {
  const { id: paramId } = useParams();
  const activePlaylistId = playlistId || paramId;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  // Contributor management states
  const [isManagingContributors, setIsManagingContributors] = useState(false);
  const [newContributorUsername, setNewContributorUsername] = useState('');
  const [contribLoading, setContribLoading] = useState(false);

  const handleAddContributor = async (e) => {
    e.preventDefault();
    if (!newContributorUsername.trim()) return;
    setContribLoading(true);
    try {
      const data = await playlistService.addContributor(activePlaylistId, newContributorUsername.trim());
      showToast(data.message || 'Contributor added!', 'success');
      setNewContributorUsername('');
      fetchPlaylistDetails();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to add contributor.', 'error');
    } finally {
      setContribLoading(false);
    }
  };

  const handleRemoveContributor = async (userId) => {
    if (!window.confirm('Remove this contributor from the collection?')) return;
    setContribLoading(true);
    try {
      const data = await playlistService.removeContributor(activePlaylistId, userId);
      showToast(data.message || 'Contributor removed.', 'success');
      fetchPlaylistDetails();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to remove contributor.', 'error');
    } finally {
      setContribLoading(false);
    }
  };

  const fetchPlaylistDetails = async () => {
    setLoading(true);
    try {
      const data = await playlistService.getPlaylistById(activePlaylistId);
      setPlaylist(data);
      setName(data.name);
      setDescription(data.description || '');
      setIsPublic(data.isPublic);
    } catch (err) {
      console.error(err);
      showToast('Could not load collection details.', 'error');
      onBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activePlaylistId) {
      fetchPlaylistDetails();
    }
  }, [activePlaylistId]);

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/playlists/${activePlaylistId}`;
    navigator.clipboard.writeText(shareUrl).then(
      () => showToast('Shareable link copied to clipboard!', 'success'),
      () => showToast('Could not copy link.', 'error')
    );
  };

  const handleRemoveWallpaper = async (e, wpId) => {
    e.stopPropagation();
    if (!window.confirm('Remove this wallpaper from the collection?')) return;

    try {
      await playlistService.removeWallpaperFromPlaylist(activePlaylistId, wpId);
      showToast('Wallpaper removed from collection.', 'success');
      fetchPlaylistDetails();
    } catch (err) {
      console.error(err);
      showToast('Failed to remove wallpaper.', 'error');
    }
  };

  const handleDeletePlaylist = async () => {
    if (!window.confirm('Are you sure you want to delete this entire collection? This action cannot be undone.')) return;

    try {
      await playlistService.deletePlaylist(activePlaylistId);
      showToast('Collection deleted.', 'success');
      onBack();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete collection.', 'error');
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaveLoading(true);
    try {
      await playlistService.updatePlaylist(activePlaylistId, {
        name: name.trim(),
        description: description.trim(),
        isPublic
      });
      showToast('Collection updated!', 'success');
      setIsEditing(false);
      fetchPlaylistDetails();
    } catch (err) {
      console.error(err);
      showToast('Failed to update collection.', 'error');
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '6rem 0' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!playlist) return null;

  const isOwner = user && playlist.creatorId === user.id;
  const isContributor = user && playlist.contributors && playlist.contributors.some(
    c => (c._id || c) === user.id || (c.username || '') === user.username
  );

  return (
    <motion.div
      className="gallery-container"
      initial={false}
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      <button className="btn-nav-link" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '2rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
        <ArrowLeft size={16} />
        <span>Back to Collections</span>
      </button>

      <div className="profile-card" style={{ padding: '2rem', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
            <div className="profile-avatar" style={{ borderRadius: '12px', background: 'var(--accent-dim)' }}>
              <Folder size={28} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 style={{ margin: '0 0 0.3rem 0', fontFamily: 'Outfit, sans-serif' }}>{playlist.name}</h2>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}>{playlist.description || 'No description provided'}</p>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>Curated by <strong style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/creator/${playlist.creator}`)}>{playlist.creator}</strong></span>
                {playlist.contributors && playlist.contributors.length > 0 && (
                  <>
                    <span>•</span>
                    <span>Collaborators: {playlist.contributors.map((c, idx) => (
                      <span key={c._id || c}>
                        {idx > 0 && ', '}
                        <strong style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/creator/${c.username}`)}>{c.username}</strong>
                      </span>
                    ))}</span>
                  </>
                )}
                <span>•</span>
                <span>{playlist.wallpapers.length} Wallpapers</span>
                <span>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                  {playlist.isPublic ? <Globe size={11} /> : <Lock size={11} />}
                  {playlist.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            {onStartSlideshow && playlist.wallpapers && playlist.wallpapers.length > 0 && (
              <button className="btn btn-primary" onClick={() => onStartSlideshow(playlist.wallpapers)} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', height: '40px' }}>
                <Play size={15} fill="currentColor" />
                <span>Play Slideshow</span>
              </button>
            )}
            {playlist.isPublic && (
              <button className="btn" onClick={handleShare} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--border-color)', height: '40px' }}>
                <Share2 size={15} />
                <span>Share</span>
              </button>
            )}
            {isOwner && (
              <button className="btn" onClick={() => setIsManagingContributors(true)} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--border-color)', height: '40px' }}>
                <UserPlus size={15} />
                <span>Collaborators</span>
              </button>
            )}
            {isOwner && (
              <>
                <button className="btn" onClick={() => setIsEditing(true)} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--border-color)', height: '40px' }}>
                  <Edit3 size={15} />
                  <span>Edit</span>
                </button>
                <button className="btn" onClick={handleDeletePlaylist} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', background: 'rgba(235, 94, 40, 0.1)', color: '#eb5e28', border: '1px solid rgba(235, 94, 40, 0.2)', height: '40px' }}>
                  <Trash2 size={15} />
                  <span>Delete</span>
                </button>
              </>
            )}
            {!isOwner && isContributor && (
              <button className="btn" onClick={() => handleRemoveContributor(user.id)} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', background: 'rgba(235, 94, 40, 0.1)', color: '#eb5e28', border: '1px solid rgba(235, 94, 40, 0.2)', height: '40px' }}>
                <span>Leave Collection</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* WALLPAPERS GRID */}
      <div>
        <h3 className="section-title" style={{ fontSize: '1.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Wallpapers ({playlist.wallpapers.length})</h3>

        {playlist.wallpapers.length === 0 ? (
          <div className="empty-state" style={{ padding: '4rem 2rem' }}>
            <Folder size={40} style={{ color: 'var(--text-muted)' }} />
            <h3>Empty Collection</h3>
            <p>There are no wallpapers in this collection yet. Browse the Explore gallery and click "Add to Collection" in any wallpaper's details to build your playlist.</p>
          </div>
        ) : (
          <div className="wallpaper-grid">
            {playlist.wallpapers.map((wp) => {
              const imgSource = wp.imageUrl?.startsWith('/uploads')
                ? `${BACKEND_URL}${wp.imageUrl}`
                : wp.imageUrl;

              return (
                <div
                  key={wp._id || wp.id}
                  className="wallpaper-card"
                  onClick={() => onZoom(wp)}
                >
                  <div className="card-img-wrapper" style={{ position: 'relative' }}>
                    <img src={imgSource} alt={wp.title} loading="lazy" />
                    {wp.isLive && (
                      <span className="live-badge" style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: 'rgba(235, 94, 40, 0.95)',
                        color: '#fff',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        boxShadow: '0 2px 10px rgba(235, 94, 40, 0.4)',
                        zIndex: 2,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        lineHeight: '1.2'
                      }}>
                        <span className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
                        <span>Live</span>
                      </span>
                    )}
                  </div>
                  <div className="card-overlay">
                    <h4 className="card-title">{wp.title}</h4>
                    <span
                      className="card-author"
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/creator/${wp.uploadedBy}`);
                      }}
                    >
                      by {wp.uploadedBy}
                    </span>
                    <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span className="badge">{wp.category}</span>
                        <button
                          className={`btn-card-like ${user && wp.likes && wp.likes.includes(user.id) ? 'liked' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onLike(wp._id || wp.id, user);
                          }}
                          title="Like"
                        >
                          <Heart size={12} fill={user && wp.likes && wp.likes.includes(user.id) ? 'currentColor' : 'none'} />
                          <span>{wp.likesCount || 0}</span>
                        </button>
                      </div>

                      {(isOwner || isContributor) && (
                        <button
                          className="btn-card-delete"
                          onClick={(e) => handleRemoveWallpaper(e, wp._id || wp.id)}
                          title="Remove from collection"
                          style={{
                            background: 'rgba(235, 94, 40, 0.15)',
                            color: '#eb5e28',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.4rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            className="modal-overlay active"
            onClick={() => setIsEditing(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '450px' }}
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
            >
              <div className="modal-header">
                <h3>Edit Collection</h3>
                <button className="modal-close" onClick={() => setIsEditing(false)}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="editPlName">Collection Name</label>
                  <input
                    type="text"
                    id="editPlName"
                    className="form-input"
                    placeholder="e.g. Cyberpunk Workspace"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={50}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="editPlDesc">Description</label>
                  <textarea
                    id="editPlDesc"
                    className="form-input"
                    placeholder="Describe your collection..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={200}
                    rows={3}
                    style={{ resize: 'none' }}
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span className="form-label">Visibility</span>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input
                        type="radio"
                        name="visibilityEdit"
                        checked={isPublic}
                        onChange={() => setIsPublic(true)}
                      />
                      <Globe size={14} style={{ color: 'var(--accent)' }} />
                      <span>Public (Shareable & listed)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input
                        type="radio"
                        name="visibilityEdit"
                        checked={!isPublic}
                        onChange={() => setIsPublic(false)}
                      />
                      <Lock size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>Private (Only you can see)</span>
                    </label>
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saveLoading}
                  style={{ width: '100%', marginTop: '0.5rem', height: '44px' }}
                >
                  {saveLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MANAGE CONTRIBUTORS MODAL */}
      <AnimatePresence>
        {isManagingContributors && (
          <motion.div
            className="modal-overlay active"
            onClick={() => setIsManagingContributors(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '450px' }}
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
            >
              <div className="modal-header">
                <h3>Collaborators</h3>
                <button className="modal-close" onClick={() => setIsManagingContributors(false)}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddContributor} style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search username to invite..."
                  value={newContributorUsername}
                  onChange={(e) => setNewContributorUsername(e.target.value)}
                  required
                  style={{ flex: 1, padding: '0.5rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-color)' }}
                />
                <button className="btn btn-primary" type="submit" disabled={contribLoading} style={{ height: '38px', padding: '0 1rem' }}>
                  {contribLoading ? 'Adding...' : 'Invite'}
                </button>
              </form>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>CURRENT COLLABORATORS</label>

                {!playlist.contributors || playlist.contributors.length === 0 ? (
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0.8rem 0' }}>No collaborators in this collection yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.8rem' }}>
                    {playlist.contributors.map(c => (
                      <div key={c._id || c} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <div className="profile-avatar" style={{ width: '28px', height: '28px', fontSize: '0.75rem', overflow: 'hidden', borderRadius: '50%' }}>
                            {c.avatarUrl ? (
                              <img src={c.avatarUrl.startsWith('/uploads') ? `${BACKEND_URL}${c.avatarUrl}` : c.avatarUrl} alt={c.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              c.username.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <strong style={{ fontSize: '0.9rem' }}>{c.username}</strong>
                        </div>
                        <button
                          className="btn"
                          onClick={() => handleRemoveContributor(c._id || c)}
                          disabled={contribLoading}
                          style={{
                            background: 'rgba(235, 94, 40, 0.1)',
                            color: '#eb5e28',
                            border: 'none',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PlaylistDetailPage;
