import React from 'react';
import { Maximize2, Download, Edit, Trash2 } from 'lucide-react';

export const WallpapersTable = ({ wallpapers, onZoom, onEdit, onDelete, currentUser, BACKEND_URL }) => {
  return (
    <div className="table-container">
      <table className="premium-table">
        <thead>
          <tr>
            <th>Preview</th>
            <th>Title</th>
            <th>Category</th>
            <th>Uploaded By</th>
            <th>Upload Date</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {wallpapers.map((wp) => {
            const imgSource = wp.imageUrl.startsWith('/uploads')
              ? `${BACKEND_URL}${wp.imageUrl}`
              : wp.imageUrl;

            const uploadDate = new Date(wp.uploadedAt || new Date());
            const isOwner = currentUser && (currentUser.id === wp.uploadedById || currentUser.username === wp.uploadedBy);

            return (
              <tr key={wp._id || wp.id}>
                <td data-label="Preview">
                  <img
                    src={imgSource}
                    alt={wp.title}
                    className="table-img-preview"
                    style={{ cursor: 'pointer' }}
                    onClick={() => onZoom(wp)}
                  />
                </td>
                <td data-label="Title">
                  <strong style={{ color: 'var(--text-main)' }}>{wp.title}</strong>
                </td>
                <td data-label="Category">
                  <span className="badge">{wp.category}</span>
                </td>
                <td data-label="Uploaded By">{wp.uploadedBy}</td>
                <td data-label="Upload Date">
                  {uploadDate.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </td>
                <td data-label="Actions" style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {isOwner && (
                      <>
                        <button
                          className="btn-card-action"
                          title="Edit Details"
                          onClick={() => onEdit(wp)}
                          style={{ backgroundColor: 'rgba(234, 179, 8, 0.25)', color: '#eab308' }}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn-card-action"
                          title="Delete Wallpaper"
                          onClick={() => onDelete(wp._id || wp.id)}
                          style={{ backgroundColor: 'rgba(239, 68, 68, 0.25)', color: '#ef4444' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    <button
                      className="btn-card-action"
                      title="Open View"
                      onClick={() => onZoom(wp)}
                    >
                      <Maximize2 size={14} />
                    </button>
                    <a
                      href={imgSource}
                      download={`${wp.title.toLowerCase().replace(/\s+/g, '-')}.jpg`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-card-action"
                      title="Download Original"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default WallpapersTable;
