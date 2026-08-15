const path = require('path');
require('dotenv').config({ quiet: true });

function splitIds(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseColor(value) {
  const normalized = String(value || '#F5A300').replace('#', '');
  const parsed = Number.parseInt(normalized, 16);
  return Number.isFinite(parsed) ? parsed : 0xf5a300;
}

function parseUrl(value, fallback) {
  try {
    const parsed = new URL(String(value || fallback));
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported URL protocol.');
    return parsed.toString();
  } catch {
    return fallback;
  }
}

const config = {
  token: process.env.DISCORD_TOKEN || '',
  applicationId: process.env.APPLICATION_ID || '1537318797399035944',
  guildId: process.env.GUILD_ID || '1534804205896732703',
  serverName: process.env.SERVER_NAME || 'Boardroom Bets',
  brandColor: parseColor(process.env.BRAND_COLOR),
  premiumUrl: parseUrl(process.env.PREMIUM_URL, 'https://www.winible.com/'),
  welcomeDmEnabled: parseBoolean(process.env.WELCOME_DM_ENABLED, false),
  channels: {
    welcome: process.env.WELCOME_CHANNEL_ID || '1538313190503612577',
    announcements: process.env.ANNOUNCEMENTS_CHANNEL_ID || '1538313193032523817',
    rules: process.env.RULES_CHANNEL_ID || '1537279969531666432',
    admin: process.env.ADMIN_CHANNEL_ID || '1538313216336334929',
    security: process.env.SECURITY_CHANNEL_ID || '1538313216336334929',
    watermark: process.env.WATERMARK_CHANNEL_ID || '1538313219792441395',
    needHelp: process.env.NEED_HELP_CHANNEL_ID || '1538313203438723202',
    premium: process.env.PREMIUM_CHANNEL_ID || '1538313200880193618',
    bankroll: process.env.BANKROLL_CHANNEL_ID || '1538313202037821451',
    gainAccess: process.env.GAIN_ACCESS_CHANNEL_ID || '1538313194517565632',
    freeChat: process.env.FREE_CHAT_CHANNEL_ID || '1538313212263538759',
    socials: process.env.SOCIALS_CHANNEL_ID || '1538313197365231726',
  },
  ticketCategoryId: process.env.TICKET_CATEGORY_ID || '1538313186829406239',
  ticketTranscriptDir: path.resolve(process.cwd(), process.env.TICKET_TRANSCRIPT_DIR || 'data/ticket-transcripts'),
  ticketTranscriptChannelId: process.env.TICKET_TRANSCRIPT_CHANNEL_ID || '1538313216336334929',
  ticketTranscriptMaxMessages: Math.min(5000, Math.max(50, parseInteger(process.env.TICKET_TRANSCRIPT_MAX_MESSAGES, 1000))),
  roles: {
    freeMember: process.env.FREE_MEMBER_ROLE_ID || '1538312001585942608',
    admin: process.env.ADMIN_ROLE_ID || '1534804381382479973',
    rulesAccepted: process.env.RULES_ACCEPTED_ROLE_ID || '1538310950195564596',
    rulesAcceptedName: process.env.RULES_ACCEPTED_ROLE_NAME || 'Rules Accepted',
  },
  picks: {
    channelIds: splitIds(process.env.PICK_CHANNEL_IDS || '1538313205531811854,1538313207717040188'),
    posterUserIds: splitIds(process.env.PICK_POSTER_USER_IDS),
  },
  watermark: {
    style: process.env.WATERMARK_STYLE || 'full-overlay',
    text: process.env.WATERMARK_TEXT || 'BOARDROOM BETS',
    logoPath: path.resolve(process.cwd(), process.env.WATERMARK_LOGO_PATH || 'assets/logo.png'),
    opacityPercent: Math.min(75, Math.max(10, parseInteger(process.env.WATERMARK_OPACITY_PERCENT, 35))),
    position: process.env.WATERMARK_POSITION || 'bottom-right',
    autoEnabled: parseBoolean(process.env.WATERMARK_AUTO_ENABLED, false),
    deleteOriginal: parseBoolean(process.env.WATERMARK_DELETE_ORIGINAL, true),
  },
  moderation: {
    enabled: parseBoolean(process.env.INVITE_MODERATION_ENABLED, false),
    timeoutMinutes: Math.min(60, Math.max(1, parseInteger(process.env.PROMOTION_TIMEOUT_MINUTES, 10))),
    whitelistUserIds: splitIds(process.env.PROMOTION_WHITELIST_USER_IDS),
  },
  features: {
    welcome: parseBoolean(process.env.FEATURE_WELCOME_ENABLED, true),
    pickHelper: parseBoolean(process.env.FEATURE_PICK_HELPER_ENABLED, false),
    bettingTools: parseBoolean(process.env.FEATURE_BETTING_TOOLS_ENABLED, false),
    permanentPanels: parseBoolean(process.env.FEATURE_PERMANENT_PANELS_ENABLED, false),
    rulesRole: parseBoolean(process.env.FEATURE_RULES_ROLE_ENABLED, false),
    ticketReviews: parseBoolean(process.env.FEATURE_TICKET_REVIEWS_ENABLED, false),
    liveScores: parseBoolean(process.env.FEATURE_LIVE_SCORES_ENABLED, false),
    banAudit: parseBoolean(process.env.FEATURE_BAN_AUDIT_ENABLED, false),
    moderation: parseBoolean(process.env.FEATURE_MODERATION_ENABLED, false),
    watermark: parseBoolean(process.env.FEATURE_WATERMARK_ENABLED, false),
    tickets: parseBoolean(process.env.FEATURE_TICKETS_ENABLED, false),
    postComposer: parseBoolean(process.env.FEATURE_POST_COMPOSER_ENABLED, false),
  },
};

function channelUrl(channelId) {
  return 'https://discord.com/channels/' + config.guildId + '/' + channelId;
}

function validateConfig() {
  if (!config.token) {
    throw new Error('DISCORD_TOKEN is required. Add it to Railway or a local .env file.');
  }
}

module.exports = {
  channelUrl,
  config,
  validateConfig,
};
