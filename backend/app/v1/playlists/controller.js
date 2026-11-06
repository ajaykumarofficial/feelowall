const { Playlist } = require('../../../databaseModels');

/**
 * Create a new playlist
 */
const createPlaylist = async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Playlist name is required.' });
    }

    const playlist = new Playlist({
      name,
      description: description || '',
      isPublic: isPublic !== undefined ? isPublic : true,
      creator: req.user.username,
      creatorId: req.user.id,
      wallpapers: []
    });

    await playlist.save();
    res.status(201).json({ message: 'Playlist created successfully.', playlist });
  } catch (error) {
    res.status(500).json({ message: 'Server error creating playlist.', error: error.message });
  }
};

/**
 * Get public playlists, or filter by creator
 */
const getPlaylists = async (req, res) => {
  try {
    const { creatorId } = req.query;
    const currentUserId = req.user ? req.user.id : null;

    let query = {};

    if (creatorId) {
      if (currentUserId && (currentUserId.toString() === creatorId.toString() || (req.user && req.user.username))) {
        // Logged-in user fetching their own playlists: return all (public + private + collaborative)
        query = {
          $or: [
            { creatorId },
            { creator: req.user.username },
            { contributors: currentUserId }
          ]
        };
      } else {
        // Other user fetching someone else's: return only public
        query = {
          $or: [
            { creatorId, isPublic: true },
            { creator: creatorId, isPublic: true }
          ]
        };
      }
    } else {
      // General exploration: public playlists or user's own private playlists
      if (currentUserId) {
        query = {
          $or: [
            { isPublic: true },
            { creatorId: currentUserId },
            { creator: req.user.username },
            { contributors: currentUserId }
          ]
        };
      } else {
        query = { isPublic: true };
      }
    }

    const playlists = await Playlist.find(query).sort({ createdAt: -1 });
    res.status(200).json(playlists);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving playlists.', error: error.message });
  }
};

/**
 * Get a playlist by ID (populates wallpapers)
 */
const getPlaylistById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user ? req.user.id : null;

    const playlist = await Playlist.findById(id)
      .populate('wallpapers')
      .populate('contributors', 'username avatarUrl');
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    // Access check
    if (!playlist.isPublic) {
      const isContributor = playlist.contributors && playlist.contributors.some(
        c => c._id.toString() === currentUserId?.toString() || c.toString() === currentUserId?.toString()
      );
      if (!currentUserId || (playlist.creatorId.toString() !== currentUserId.toString() && !isContributor)) {
        return res.status(403).json({ message: 'This playlist is private.' });
      }
    }

    res.status(200).json(playlist);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving playlist.', error: error.message });
  }
};

/**
 * Update playlist details
 */
const updatePlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isPublic } = req.body;

    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    // Verify ownership
    if (playlist.creatorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to update this playlist.' });
    }

    if (name !== undefined) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (isPublic !== undefined) playlist.isPublic = isPublic;

    await playlist.save();
    res.status(200).json({ message: 'Playlist updated successfully.', playlist });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating playlist.', error: error.message });
  }
};

/**
 * Delete a playlist
 */
const deletePlaylist = async (req, res) => {
  try {
    const { id } = req.params;

    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    // Verify ownership
    if (playlist.creatorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to delete this playlist.' });
    }

    await Playlist.deleteOne({ _id: id });
    res.status(200).json({ message: 'Playlist deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting playlist.', error: error.message });
  }
};

/**
 * Add a wallpaper to a playlist
 */
const addWallpaperToPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const { wallpaperId } = req.body;

    if (!wallpaperId) {
      return res.status(400).json({ message: 'Wallpaper ID is required.' });
    }

    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    // Verify ownership or contributor status
    const isContributor = playlist.contributors && playlist.contributors.some(c => c.toString() === req.user.id);
    if (playlist.creatorId.toString() !== req.user.id && !isContributor) {
      return res.status(403).json({ message: 'Unauthorized to modify this playlist.' });
    }

    // Check if wallpaper already exists in playlist
    if (playlist.wallpapers.includes(wallpaperId)) {
      return res.status(400).json({ message: 'Wallpaper is already in this playlist.' });
    }

    playlist.wallpapers.push(wallpaperId);
    await playlist.save();

    res.status(200).json({ message: 'Wallpaper added to playlist successfully.', playlist });
  } catch (error) {
    res.status(500).json({ message: 'Server error adding wallpaper to playlist.', error: error.message });
  }
};

/**
 * Remove a wallpaper from a playlist
 */
const removeWallpaperFromPlaylist = async (req, res) => {
  try {
    const { id, wpId } = req.params;

    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    // Verify ownership or contributor status
    const isContributor = playlist.contributors && playlist.contributors.some(c => c.toString() === req.user.id);
    if (playlist.creatorId.toString() !== req.user.id && !isContributor) {
      return res.status(403).json({ message: 'Unauthorized to modify this playlist.' });
    }

    const index = playlist.wallpapers.indexOf(wpId);
    if (index === -1) {
      return res.status(404).json({ message: 'Wallpaper not found in this playlist.' });
    }

    playlist.wallpapers.splice(index, 1);
    await playlist.save();

    res.status(200).json({ message: 'Wallpaper removed from playlist successfully.', playlist });
  } catch (error) {
    res.status(500).json({ message: 'Server error removing wallpaper from playlist.', error: error.message });
  }
};

/**
 * Add a contributor to a playlist
 */
const addContributor = async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: 'Username is required.' });
    }

    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    // Only creator can manage contributors
    if (playlist.creatorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the collection owner can add contributors.' });
    }

    // Find user to add
    const { User } = require('../../../databaseModels');
    const userToAdd = await User.findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } });
    if (!userToAdd) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (userToAdd._id.toString() === playlist.creatorId.toString()) {
      return res.status(400).json({ message: 'Owner is already the main creator and cannot be added as contributor.' });
    }

    // Ensure contributors array exists
    if (!playlist.contributors) playlist.contributors = [];

    if (playlist.contributors.includes(userToAdd._id)) {
      return res.status(400).json({ message: 'User is already a contributor.' });
    }

    playlist.contributors.push(userToAdd._id);
    await playlist.save();

    const updatedPlaylist = await Playlist.findById(id).populate('contributors', 'username avatarUrl');

    res.status(200).json({
      message: `${userToAdd.username} added as contributor.`,
      contributors: updatedPlaylist.contributors
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error adding contributor.', error: error.message });
  }
};

/**
 * Remove a contributor from a playlist
 */
const removeContributor = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const playlist = await Playlist.findById(id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found.' });
    }

    // Creator can remove anyone, a contributor can remove themselves (leave)
    const isOwner = playlist.creatorId.toString() === req.user.id;
    const isSelf = req.user.id === userId;

    if (!isOwner && !isSelf) {
      return res.status(403).json({ message: 'Unauthorized to remove contributor.' });
    }

    if (!playlist.contributors || !playlist.contributors.includes(userId)) {
      return res.status(404).json({ message: 'Contributor not found in this collection.' });
    }

    const index = playlist.contributors.indexOf(userId);
    playlist.contributors.splice(index, 1);
    await playlist.save();

    const updatedPlaylist = await Playlist.findById(id).populate('contributors', 'username avatarUrl');

    res.status(200).json({
      message: 'Contributor removed successfully.',
      contributors: updatedPlaylist.contributors
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error removing contributor.', error: error.message });
  }
};

module.exports = {
  createPlaylist,
  getPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addWallpaperToPlaylist,
  removeWallpaperFromPlaylist,
  addContributor,
  removeContributor
};
