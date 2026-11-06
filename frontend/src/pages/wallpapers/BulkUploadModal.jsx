import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, X, Upload, Trash2, Type, Tag, CheckCircle2, AlertCircle, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper to convert filename to title-case readable string
const formatFilenameToTitle = (filename) => {
  const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
  // Replace underscores, dashes, and multiple spaces with a single space
  const spaced = nameWithoutExt.replace(/[_-]+/g, ' ');
  // Title case capitalizing first letters
  return spaced
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const BulkUploadModal = ({
  isOpen,
  onClose,
  onBulkUpload,
  showToast
}) => {
  const [batchItems, setBatchItems] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Global apply fields
  const [globalCategory, setGlobalCategory] = useState('');
  const [globalTags, setGlobalTags] = useState('');

  // Overall process states
  const [isPublishing, setIsPublishing] = useState(false);
  const [overallProgress, setOverallProgress] = useState('');

  // Reset modal state on open/close
  useEffect(() => {
    if (!isOpen) {
      // Revoke object URLs to avoid memory leaks
      batchItems.forEach(item => {
        if (item.previewUrl && item.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      setBatchItems([]);
      setGlobalCategory('');
      setGlobalTags('');
      setIsPublishing(false);
      setOverallProgress('');
    }
  }, [isOpen]);

  const handleFiles = (selectedFiles) => {
    const newItems = Array.from(selectedFiles)
      .filter((file) => {
        if (!file.type.startsWith('image/')) {
          showToast(`File "${file.name}" is not an image and was skipped.`, 'error');
          return false;
        }
        if (file.size > 5 * 1024 * 1024) {
          showToast(`File "${file.name}" exceeds the 5MB size limit.`, 'error');
          return false;
        }
        return true;
      })
      .map((file) => ({
        id: Date.now() + Math.random().toString(36).substring(2, 9),
        file,
        previewUrl: URL.createObjectURL(file),
        title: formatFilenameToTitle(file.name),
        category: 'Nature', // default initial category
        tags: '',
        status: 'idle', // 'idle' | 'uploading' | 'success' | 'error'
        errorMsg: ''
      }));

    if (newItems.length > 0) {
      setBatchItems((prev) => [...prev, ...newItems]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeBatchItem = (id) => {
    setBatchItems((prev) => {
      const target = prev.find(item => item.id === id);
      if (target && target.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleUpdateItem = (id, field, value) => {
    setBatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const applyGlobalSettings = () => {
    if (!globalCategory && !globalTags) {
      showToast('Please specify a category or tags to apply.', 'info');
      return;
    }

    setBatchItems((prev) =>
      prev.map((item) => {
        const updated = { ...item };
        if (globalCategory) {
          updated.category = globalCategory;
        }
        if (globalTags) {
          updated.tags = globalTags;
        }
        return updated;
      })
    );

    showToast('Applied global values to all batch items!', 'success');
  };

  const handlePublishAll = async (e) => {
    e.preventDefault();
    if (batchItems.length === 0) {
      showToast('Please select at least one wallpaper to upload.', 'error');
      return;
    }

    const uncompletedItems = batchItems.filter(item => item.status !== 'success');
    if (uncompletedItems.length === 0) {
      showToast('All wallpapers have already been successfully uploaded.', 'info');
      return;
    }

    setIsPublishing(true);
    let successCount = batchItems.filter(item => item.status === 'success').length;
    let failedCount = 0;

    for (let i = 0; i < batchItems.length; i++) {
      const item = batchItems[i];
      if (item.status === 'success') continue;

      setOverallProgress(`Uploading ${successCount + failedCount + 1} of ${batchItems.length}...`);
      
      // Update item status in grid to uploading
      setBatchItems(prev => prev.map(bi => bi.id === item.id ? { ...bi, status: 'uploading' } : bi));

      try {
        const result = await onBulkUpload(item);
        if (result.success) {
          successCount++;
          setBatchItems(prev => prev.map(bi => bi.id === item.id ? { ...bi, status: 'success' } : bi));
        } else {
          failedCount++;
          setBatchItems(prev => prev.map(bi => bi.id === item.id ? { ...bi, status: 'error', errorMsg: result.message || 'Failed' } : bi));
        }
      } catch (err) {
        failedCount++;
        setBatchItems(prev => prev.map(bi => bi.id === item.id ? { ...bi, status: 'error', errorMsg: err.message || 'Upload failed' } : bi));
      }
    }

    setIsPublishing(false);
    setOverallProgress('');

    if (failedCount === 0) {
      showToast('All wallpapers uploaded successfully!', 'success');
      onClose();
    } else {
      showToast(`Upload completed: ${successCount} successful, ${failedCount} failed. Please review errors.`, 'warning');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay active"
          onClick={() => !isPublishing && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ zIndex: 1100 }}
        >
          <motion.div
            className="modal-card bulk-upload-card"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            style={{
              maxWidth: '1000px',
              width: '95%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '2rem'
            }}
          >
            {!isPublishing && (
              <button className="modal-close" onClick={onClose}>
                <X size={20} />
              </button>
            )}

            <h3 className="form-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Layers className="title-icon" size={24} style={{ color: 'var(--accent)' }} />
              <span>Bulk Wallpaper Upload</span>
            </h3>
            <p className="form-subtitle" style={{ marginBottom: '1.2rem' }}>
              Drag-and-drop multiple images to configure and upload them in a batch. (Max 5MB per file)
            </p>

            {batchItems.length === 0 ? (
              <div
                className={`drop-zone ${dragOver ? 'dragover' : ''}`}
                onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '220px', marginBottom: '1rem' }}
              >
                <input
                  type="file"
                  id="bulkUploadFiles"
                  accept="image/*"
                  multiple
                  ref={fileInputRef}
                  onChange={(e) => e.target.files.length > 0 && handleFiles(e.target.files)}
                  style={{ display: 'none' }}
                />
                <div className="drop-zone-content">
                  <UploadCloud className="drop-icon" size={48} style={{ color: 'var(--accent)', marginBottom: '0.8rem' }} />
                  <p className="drop-text" style={{ fontSize: '1.05rem', fontWeight: 500 }}>
                    Drag & drop files here or <span className="browse-link">browse</span>
                  </p>
                  <p className="drop-subtext" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    Supports PNG, JPG, JPEG, GIF up to 5MB each.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                
                <div className="bulk-global-controls" style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginBottom: '1.2rem',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Bulk Category</label>
                    <select
                      value={globalCategory}
                      onChange={(e) => setGlobalCategory(e.target.value)}
                      className="select-dropdown"
                      style={{ width: '100%', padding: '0.4rem 0.8rem', height: '36px', fontSize: '0.85rem' }}
                      disabled={isPublishing}
                    >
                      <option value="">-- Choose Category --</option>
                      <option value="Nature">Nature</option>
                      <option value="Minimalist">Minimalist</option>
                      <option value="Space">Space</option>
                      <option value="Anime">Anime</option>
                      <option value="Architecture">Architecture</option>
                    </select>
                  </div>

                  <div style={{ flex: 2, minWidth: '220px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Bulk Tags</label>
                    <input
                      type="text"
                      placeholder="e.g. minimal, aesthetic, dark (comma-separated)"
                      value={globalTags}
                      onChange={(e) => setGlobalTags(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-main)',
                        padding: '0.4rem 0.8rem',
                        height: '36px',
                        fontSize: '0.85rem'
                      }}
                      disabled={isPublishing}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={applyGlobalSettings}
                    style={{ height: '36px', fontSize: '0.85rem', padding: '0 1rem' }}
                    disabled={isPublishing}
                  >
                    Apply to All
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      if (window.confirm('Clear all wallpapers from this batch?')) {
                        setBatchItems([]);
                      }
                    }}
                    style={{ height: '36px', fontSize: '0.85rem', padding: '0 1.2rem', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                    disabled={isPublishing}
                  >
                    Clear All
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ height: '36px', fontSize: '0.85rem', padding: '0 1rem', marginLeft: 'auto' }}
                    disabled={isPublishing}
                  >
                    + Add More
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    ref={fileInputRef}
                    onChange={(e) => e.target.files.length > 0 && handleFiles(e.target.files)}
                    style={{ display: 'none' }}
                  />
                </div>

                <div className="bulk-grid-editor" style={{
                  flex: 1,
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  padding: '1rem',
                  marginBottom: '1.2rem'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {batchItems.map((item) => (
                      <div
                        key={item.id}
                        className={`bulk-grid-row status-${item.status}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '0.8rem',
                          borderRadius: '8px',
                          background: 'var(--bg-card)',
                          border: `1px solid ${
                            item.status === 'success'
                              ? '#22c55e'
                              : item.status === 'error'
                              ? '#ef4444'
                              : item.status === 'uploading'
                              ? 'var(--accent)'
                              : 'var(--border-color)'
                          }`,
                          position: 'relative'
                        }}
                      >
                        <div style={{
                          width: '70px',
                          height: '50px',
                          borderRadius: '4px',
                          overflow: 'hidden',
                          border: '1px solid var(--border-color)',
                          flexShrink: 0
                        }}>
                          <img
                            src={item.previewUrl}
                            alt="preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>

                        <div style={{ flex: 2, minWidth: '160px' }}>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateItem(item.id, 'title', e.target.value)}
                            placeholder="Title"
                            style={{
                              width: '100%',
                              background: 'var(--bg-form-input)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              color: 'var(--text-main)',
                              padding: '0.35rem 0.7rem',
                              fontSize: '0.88rem'
                            }}
                            required
                            disabled={isPublishing || item.status === 'success'}
                          />
                        </div>

                        <div style={{ width: '130px', flexShrink: 0 }}>
                          <select
                            value={item.category}
                            onChange={(e) => handleUpdateItem(item.id, 'category', e.target.value)}
                            className="select-dropdown"
                            style={{
                              width: '100%',
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.82rem',
                              height: '32px'
                            }}
                            required
                            disabled={isPublishing || item.status === 'success'}
                          >
                            <option value="Nature">Nature</option>
                            <option value="Minimalist">Minimalist</option>
                            <option value="Space">Space</option>
                            <option value="Anime">Anime</option>
                            <option value="Architecture">Architecture</option>
                          </select>
                        </div>

                        <div style={{ flex: 2, minWidth: '160px' }}>
                          <input
                            type="text"
                            value={item.tags}
                            onChange={(e) => handleUpdateItem(item.id, 'tags', e.target.value)}
                            placeholder="Tags (comma separated)"
                            style={{
                              width: '100%',
                              background: 'var(--bg-form-input)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              color: 'var(--text-main)',
                              padding: '0.35rem 0.7rem',
                              fontSize: '0.88rem'
                            }}
                            disabled={isPublishing || item.status === 'success'}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                          {item.status === 'uploading' && (
                            <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
                          )}
                          {item.status === 'success' && (
                            <CheckCircle2 size={20} style={{ color: '#22c55e' }} title="Uploaded successfully" />
                          )}
                          {item.status === 'error' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ef4444' }}>
                              <AlertCircle size={20} title={item.errorMsg} />
                              <span style={{ fontSize: '0.75rem', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.errorMsg}</span>
                            </div>
                          )}
                          {!isPublishing && item.status !== 'success' && (
                            <button
                              type="button"
                              onClick={() => removeBatchItem(item.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(239, 68, 68, 0.7)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Remove"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--accent)' }}>
                    {isPublishing ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                        <span>{overallProgress}</span>
                      </span>
                    ) : (
                      <span>{batchItems.length} wallpaper{batchItems.length === 1 ? '' : 's'} ready in batch</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.8rem' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={onClose}
                      disabled={isPublishing}
                      style={{ padding: '0 1.5rem', height: '40px' }}
                    >
                      {batchItems.every(item => item.status === 'success') ? 'Close' : 'Cancel'}
                    </button>
                    
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handlePublishAll}
                      disabled={isPublishing || batchItems.length === 0}
                      style={{ padding: '0 2rem', height: '40px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      {isPublishing ? 'Publishing...' : 'Publish All'}
                    </button>
                  </div>
                </div>

              </div>
            )}

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BulkUploadModal;
