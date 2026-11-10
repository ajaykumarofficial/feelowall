const express = require('express');
const router = express.Router();
const { SavedSearch } = require('../../../databaseModels');
const { asyncHandler, HttpError } = require('../../../helper/asyncHandler');
const { asString } = require('../../../helper/text');
const { authenticateToken } = require('../../../middleware/auth');

const MAX_SAVED_SEARCHES = 25;

router.use(authenticateToken);

router.get('/', asyncHandler(async (req, res) => {
  const searches = await SavedSearch.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
  res.status(200).json({ searches });
}));

router.post('/', asyncHandler(async (req, res) => {
  const search = asString(req.body.search);
  const category = asString(req.body.category);
  const tag = asString(req.body.tag).toLowerCase();
  if (!search && (!category || category === 'All') && !tag) {
    throw new HttpError(400, 'Enter a search, category, or tag to save.');
  }
  if (await SavedSearch.countDocuments({ userId: req.user.id }) >= MAX_SAVED_SEARCHES) {
    throw new HttpError(400, `You can save up to ${MAX_SAVED_SEARCHES} searches.`);
  }
  const saved = await SavedSearch.create({
    userId: req.user.id,
    name: asString(req.body.name).slice(0, 80) || search || tag || category,
    search,
    category: category === 'All' ? '' : category,
    tag,
    alertsEnabled: req.body.alertsEnabled !== false
  });
  res.status(201).json({ message: 'Search saved. We\'ll notify you about new matches.', search: saved });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const saved = await SavedSearch.findOne({ _id: req.params.id, userId: req.user.id });
  if (!saved) throw new HttpError(404, 'Saved search not found.');
  if (typeof req.body.alertsEnabled === 'boolean') saved.alertsEnabled = req.body.alertsEnabled;
  await saved.save();
  res.status(200).json({ message: 'Saved search updated.', search: saved });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const result = await SavedSearch.deleteOne({ _id: req.params.id, userId: req.user.id });
  if (!result.deletedCount) throw new HttpError(404, 'Saved search not found.');
  res.status(200).json({ message: 'Saved search deleted.' });
}));

module.exports = router;
