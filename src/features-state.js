const FEATURE_LABELS = Object.freeze({
  welcome: 'Welcome messages',
  pickHelper: 'Automatic pick helper',
  bettingTools: 'Betting guides and calculators',
  permanentPanels: 'Permanent information panels',
  rulesRole: 'Rules reaction role',
  ticketReviews: 'Ticket reviews',
  liveScores: 'Live scores',
  banAudit: 'Manual ban audit',
  moderation: 'Promotion moderation',
  watermark: 'Watermark engine',
  tickets: 'Support tickets',
  postComposer: 'Post composer',
});

const FEATURE_CHOICES = Object.entries(FEATURE_LABELS).map(([value, name]) => ({ name, value }));

class FeatureState {
  constructor(defaults = {}) {
    this.values = new Map(Object.keys(FEATURE_LABELS).map((key) => [key, defaults[key] !== false]));
  }

  has(key) {
    return Object.hasOwn(FEATURE_LABELS, key);
  }

  isEnabled(key) {
    return this.has(key) && this.values.get(key) !== false;
  }

  set(key, enabled) {
    if (!this.has(key)) throw new Error('Unknown feature: ' + key);
    this.values.set(key, Boolean(enabled));
  }

  lines() {
    return Object.entries(FEATURE_LABELS).map(([key, label]) =>
      (this.isEnabled(key) ? '✅' : '⏸️') + ' ' + label
    );
  }
}

module.exports = { FEATURE_CHOICES, FEATURE_LABELS, FeatureState };
