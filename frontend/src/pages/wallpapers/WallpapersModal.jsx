import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, Upload, Trash2, Type, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const WallpapersModal = ({
  isOpen,
  onClose,
  onUpload,
  onUpdate,
  editingWp,
  uploadLoading,
  showToast
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Live Wallpaper States
  const [isLive, setIsLive] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const videoInputRef = useRef(null);

  useEffect(() => {
    if (editingWp) {
      setTitle(editingWp.title || '');
      setCategory(editingWp.category || '');
      setIsLive(editingWp.isLive || false);
      setVideoFile(null);
      setVideoPreviewUrl('');
    } else {
      setTitle('');
      setCategory('');
      setFile(null);
      setPreviewUrl('');
      setIsLive(false);
      setVideoFile(null);
      setVideoPreviewUrl('');
    }
  }, [editingWp, isOpen]);

  // Removed immediate null return to support exit transitions with AnimatePresence

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      return;
    }
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const clearFile = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleVideoChange = (selectedVideo) => {
    if (!selectedVideo) return;
    if (!selectedVideo.type.startsWith('video/')) {
      showToast('Please select a video file (MP4/WebM).', 'error');
      return;
    }
    if (selectedVideo.size > 15 * 1024 * 1024) {
      showToast('Video loop size must be less than 15MB.', 'error');
      return;
    }
    setVideoFile(selectedVideo);
    const url = URL.createObjectURL(selectedVideo);
    setVideoPreviewUrl(url);
  };

  const clearVideoFile = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setVideoFile(null);
    setVideoPreviewUrl('');
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingWp) {
      await onUpdate(editingWp._id || editingWp.id, title, category);
    } else {
      if (!file) {
        showToast('Please select a cover image file to upload.', 'error');
        return;
      }
      if (isLive && !videoFile) {
        showToast('Please upload a video loop file for the live wallpaper.', 'error');
        return;
      }
      const res = await onUpload(title, category, file, isLive ? videoFile : null);
      if (res.success) {
        setTitle('');
        setCategory('');
        clearFile();
        clearVideoFile();
        setIsLive(false);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay active"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
          >
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <h3 className="form-title">
          <UploadCloud className="title-icon" size={24} style={{ color: 'var(--accent)' }} />
          <span>{editingWp ? 'Edit Wallpaper' : 'Upload Wallpaper'}</span>
        </h3>
        <p className="form-subtitle">
          {editingWp
            ? 'Modify the title and category of your community submission.'
            : 'Share your wallpaper with the community. Accepted formats: JPG, PNG, GIF up to 5MB.'}
        </p>

        <form onSubmit={handleSubmit} className="upload-form">
          {/* Content Preview Zone */}
          {editingWp ? (
            <div className="preview-container" style={{ display: 'block', marginBottom: '1.5rem' }}>
              <img
                src={
                  editingWp.imageUrl.startsWith('/uploads')
                    ? `http://localhost:5000${editingWp.imageUrl}`
                    : editingWp.imageUrl
                }
                alt={editingWp.title}
              />
            </div>
          ) : (
            /* Drag & Drop Zone */
            <div
              className={`drop-zone ${dragOver ? 'dragover' : ''} ${previewUrl ? 'has-preview' : ''}`}
              onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
            >
              <input
                type="file"
                id="uploadFile"
                accept="image/*"
                className="file-input"
                ref={fileInputRef}
                onChange={(e) => e.target.files.length > 0 && handleFileChange(e.target.files[0])}
                style={{ display: 'none' }}
              />

              {!previewUrl ? (
                <div className="drop-zone-content">
                  <Upload className="drop-icon" size={32} style={{ color: 'var(--accent)', marginBottom: '0.5rem' }} />
                  <p className="drop-text">Drag & drop your image here or <span className="browse-link">browse</span></p>
                </div>
              ) : (
                <div className="preview-container" style={{ display: 'block' }}>
                  <img src={previewUrl} alt="Upload Preview" />
                  <button type="button" className="btn-remove-preview" onClick={clearFile}>
                    <Trash2 size={14} />
                    <span>Remove</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Live Wallpaper checkbox (only when creating new) */}
          {!editingWp && (
            <div className="form-group" style={{ margin: '1.2rem 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none', fontWeight: '600' }}>
                <input
                  type="checkbox"
                  checked={isLive}
                  onChange={(e) => {
                    setIsLive(e.target.checked);
                    if (!e.target.checked) {
                      clearVideoFile();
                    }
                  }}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                />
                <span>This is a Live Wallpaper (Animated Video Loop)</span>
              </label>
            </div>
          )}

          {/* Video Drop Zone (only when isLive is checked and not editing) */}
          {!editingWp && isLive && (
            <div className="form-group" style={{ margin: '1.2rem 0' }}>
              <label htmlFor="uploadVideo" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '500' }}>Video Loop (MP4 or WebM, Max 15MB)</label>
              <div 
                className="drop-zone"
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  background: 'var(--bg-input)',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onClick={() => !videoFile && videoInputRef.current?.click()}
              >
                <input
                  type="file"
                  id="uploadVideo"
                  accept="video/mp4,video/webm"
                  ref={videoInputRef}
                  onChange={(e) => e.target.files.length > 0 && handleVideoChange(e.target.files[0])}
                  style={{ display: 'none' }}
                />

                {!videoPreviewUrl ? (
                  <div className="drop-zone-content">
                    <Upload className="drop-icon" size={24} style={{ color: 'var(--accent)', marginBottom: '0.5rem' }} />
                    <p className="drop-text" style={{ fontSize: '0.85rem' }}>Click or drop video loop file</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
                    <video 
                      src={videoPreviewUrl} 
                      muted 
                      loop 
                      autoPlay 
                      style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '4px', border: '1px solid var(--border-color)' }} 
                    />
                    <button 
                      type="button" 
                      className="btn-remove-preview" 
                      onClick={clearVideoFile}
                      style={{
                        padding: '0.3rem 0.8rem',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        margin: '0 auto'
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Remove Video</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form fields */}
          <div className="form-group">
            <label htmlFor="uploadTitle">Title</label>
            <div className="input-wrapper">
              <Type className="input-icon" size={18} />
              <input
                type="text"
                id="uploadTitle"
                placeholder="e.g. Neon Horizon"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="uploadCategory">Category</label>
            <div className="input-wrapper">
              <Tag className="input-icon" size={18} />
              <select
                id="uploadCategory"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="" disabled>Select category</option>
                <option value="Nature">Nature</option>
                <option value="Minimalist">Minimalist</option>
                <option value="Space">Space</option>
                <option value="Anime">Anime</option>
                <option value="Architecture">Architecture</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={uploadLoading}>
            {uploadLoading ? (
              <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto', borderWidth: '2px' }}></div>
            ) : (
              <span>{editingWp ? 'Save Changes' : 'Publish Wallpaper'}</span>
            )}
          </button>
        </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
  );
};

export default WallpapersModal;
