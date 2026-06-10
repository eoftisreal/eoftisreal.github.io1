const express = require('express');
const Setting = require('../models/Setting');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/public/settings', async (_req, res, next) => {
  try {
    const publicKeys = ['heroBannerUrl', 'enableEmailDelivery', 'enableWhatsappDelivery', 'customFeatureIconUrl'];
    const settingsDocs = await Setting.find({ key: { $in: publicKeys } });
    const settings = {};
    settingsDocs.forEach(s => {
      settings[s.key] = s.value;
    });
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
