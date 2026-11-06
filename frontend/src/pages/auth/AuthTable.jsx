import React from 'react';
import { Edit, Trash2 } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const AuthTable = ({ wallpapers, user, onEdit, onDelete }) => {
  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
        Please log in to see your uploads.
      </div>
    );
  }

  // Filter wallpapers uploaded by this user
  const userWallpapers = wallpapers.filter(
    (wp) => wp.uploadedById === user.id || wp.uploadedBy === user.username
  );

  return (
    <div className="table-container">
      <table className="premium-table">
        <thead>
          <tr>
            <th>Image</th>
            <th>Title</th>
            <th>Category</th>
            <th>Uploaded At</th>
            <th>Filename</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {userWallpapers.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                You haven't uploaded any wallpapers yet.
              </td>
            </tr>
          ) : (
            userWallpapers.map((wp) => {
              const uploadDate = new Date(wp.uploadedAt || new Date());
              return (
                <tr key={wp._id || wp.id}>
                  <td data-label="Image">
                    <img
                      src={wp.imageUrl.startsWith('/uploads') ? `${BACKEND_URL}${wp.imageUrl}` : wp.imageUrl}
                      alt={wp.title}
                      className="table-img-preview"
                    />
                  </td>
                  <td data-label="Title"><strong>{wp.title}</strong></td>
                  <td data-label="Category"><span className="badge">{wp.category}</span></td>
                  <td data-label="Uploaded At">{uploadDate.toLocaleDateString()}</td>
                  <td data-label="Filename"><code style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{wp.filename}</code></td>
                  <td data-label="Actions" style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
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
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AuthTable;
