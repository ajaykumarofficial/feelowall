import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/useAuth';
import playlistService from '../../services/playlistService';
import { Folder, Lock, Globe, Plus, X, ArrowRight, BookOpen } from 'lucide-react';
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

export const PlaylistsPage = ({ onSelectPlaylist, showToast }) => {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const data = await playlistService.getPlaylists();
      setPlaylists(data);
    } catch (err) {
      console.error(err);
      showToast('Could not load collections.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreateLoading(true);
    try {
      await playlistService.createPlaylist(name.trim(), description.trim(), isPublic);
      showToast('Collection created successfully!', 'success');
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setIsPublic(true);
      fetchPlaylists();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to create collection.', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const myPlaylists = user
    ? playlists.filter(p =>
        (p.creatorId && (p.creatorId === user.id || p.creatorId === user._id || p.creatorId._id === user.id || p.creatorId._id === user._id)) ||
        (p.creator && user.username && p.creator.toLowerCase() === user.username.toLowerCase()) ||
        (p.contributors && p.contributors.some(c => (c._id || c) === user.id || (c._id || c) === user._id || (c.username || '') === user.username))
      )
    : [];

  const publicPlaylists = playlists.filter(p => p.isPublic && !myPlaylists.some(mp => mp._id === p._id));

  return (
    <motion.div
      className="gallery-container"
      initial={false}
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
    >
      <div className="gallery-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="section-title">Thematic Collections</h2>
          <p className="section-desc">Browse community curated wallpaper playlists or create your own</p>
        </div>
        {user && (
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} />
            <span>New Collection</span>
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '4rem 0' }}>
          <div className="loading-spinner"></div>
        </div>
      ) : (
        <div>
          {/* USER'S PLAYLISTS */}
          {user && (
            <div style={{ marginBottom: '3rem' }}>
              <h3 className="section-title" style={{ fontSize: '1.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>My Collections</h3>
              {myPlaylists.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <Folder size={32} style={{ color: 'var(--text-muted)' }} />
                  <p>You haven't created any collections yet.</p>
                </div>
              ) : (
                <div className="playlist-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  {myPlaylists.map((pl) => (
                    <div
                      key={pl._id}
                      className="playlist-item-card"
                      onClick={() => onSelectPlaylist(pl._id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="playlist-info">
                        <Folder className="playlist-folder-icon" size={24} />
                        <h4>{pl.name}</h4>
                        <p>{pl.description || 'No description'}</p>
                      </div>
                      <div className="playlist-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          {pl.isPublic ? <Globe size={12} /> : <Lock size={12} />}
                          {pl.isPublic ? 'Public' : 'Private'}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {pl.wallpapers.length} wallpapers
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* COMMUNITY PLAYLISTS */}
          <div>
            <h3 className="section-title" style={{ fontSize: '1.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>Public Collections</h3>
            {publicPlaylists.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                <BookOpen size={36} style={{ color: 'var(--text-muted)' }} />
                <h3>No Public Collections</h3>
                <p>Check back later or create one to share with the community!</p>
              </div>
            ) : (
              <div className="playlist-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {publicPlaylists.map((pl) => (
                  <div
                    key={pl._id}
                    className="playlist-item-card"
                    onClick={() => onSelectPlaylist(pl._id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="playlist-info">
                      <Folder className="playlist-folder-icon" size={24} />
                      <h4>{pl.name}</h4>
                      <p>{pl.description || 'No description'}</p>
                    </div>
                    <div className="playlist-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        by <strong>{pl.creator}</strong>
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {pl.wallpapers.length} wallpapers
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="modal-overlay active"
            onClick={() => setIsModalOpen(false)}
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
                <h3>Create Collection</h3>
                <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreatePlaylist} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="plName">Collection Name</label>
                  <input
                    type="text"
                    id="plName"
                    className="form-input"
                    placeholder="e.g. Cyberpunk Workspace, Cozy Coffee Shop"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={50}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="plDesc">Description (Optional)</label>
                  <textarea
                    id="plDesc"
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
                        name="visibility"
                        checked={isPublic}
                        onChange={() => setIsPublic(true)}
                      />
                      <Globe size={14} style={{ color: 'var(--accent)' }} />
                      <span>Public (Shareable & listed)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input
                        type="radio"
                        name="visibility"
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
                  disabled={createLoading}
                  style={{ width: '100%', marginTop: '0.5rem', height: '44px' }}
                >
                  {createLoading ? 'Creating...' : 'Create Collection'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PlaylistsPage;
