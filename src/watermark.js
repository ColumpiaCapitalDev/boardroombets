const fs = require('fs/promises');
const path = require('path');
const { AttachmentBuilder, MessageFlags } = require('discord.js');
const sharp = require('sharp');
const { isAdminMember, requireAdmin } = require('./auth');

const SUPPORTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 15 * 1024 * 1024;

async function logoExists(config) {
  if (config.watermark.style === 'x-text') return true;
  return fs.access(config.watermark.logoPath).then(() => true).catch(() => false);
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xTextOverlay(width, height, text, opacityPercent) {
  const centerX = Math.round(width / 2);
  const centerY = Math.round(height / 2);
  const diagonal = Math.hypot(width, height);
  const angle = Math.atan2(height, width) * (180 / Math.PI);
  const fontSize = Math.max(24, Math.round(Math.min(width, height) * 0.07));
  const strokeWidth = Math.max(1, Math.round(fontSize * 0.055));
  const letterSpacing = Math.max(2, Math.round(fontSize * 0.08));
  const textLength = Math.round(diagonal * 0.82);
  const opacity = Math.min(0.75, Math.max(0.1, Number(opacityPercent) / 100));
  const phrase = escapeXml([text, '×', text].join('  '));

  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.75"/>
        </filter>
      </defs>
      <g text-anchor="middle" dominant-baseline="middle" font-family="Arial Black, Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="900" letter-spacing="${letterSpacing}" stroke="#090909" stroke-width="${strokeWidth}" paint-order="stroke fill" filter="url(#shadow)">
        <text x="${centerX}" y="${centerY}" transform="rotate(${angle.toFixed(3)} ${centerX} ${centerY})" textLength="${textLength}" lengthAdjust="spacingAndGlyphs" fill="#ffffff" opacity="${opacity.toFixed(3)}">${phrase}</text>
        <text x="${centerX}" y="${centerY}" transform="rotate(${-angle.toFixed(3)} ${centerX} ${centerY})" textLength="${textLength}" lengthAdjust="spacingAndGlyphs" fill="#f5a300" opacity="${Math.max(0.1, opacity * 0.92).toFixed(3)}">${phrase}</text>
      </g>
    </svg>`
  );
}

async function downloadImage(attachment) {
  if (!SUPPORTED_TYPES.has(attachment.contentType) || attachment.size > MAX_BYTES) {
    throw new Error('Use a PNG, JPG, or WebP image no larger than 15 MB.');
  }
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error('Discord could not download that image.');
  return Buffer.from(await response.arrayBuffer());
}

function positionFor(config, image, logo) {
  const margin = Math.max(18, Math.round(Math.min(image.width, image.height) * 0.025));
  const positions = {
    'top-left': { left: margin, top: margin },
    'top-right': { left: image.width - logo.width - margin, top: margin },
    'bottom-left': { left: margin, top: image.height - logo.height - margin },
    'bottom-right': { left: image.width - logo.width - margin, top: image.height - logo.height - margin },
    center: { left: Math.round((image.width - logo.width) / 2), top: Math.round((image.height - logo.height) / 2) },
  };
  return positions[config.watermark.position] || positions['bottom-right'];
}

async function applyOpacity(image, opacityPercent) {
  const multiplier = Math.min(0.75, Math.max(0.1, Number(opacityPercent) / 100));
  const raw = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (raw.info.channels !== 4) throw new Error('The watermark asset must support transparency.');
  for (let index = 3; index < raw.data.length; index += 4) {
    raw.data[index] = Math.round(raw.data[index] * multiplier);
  }
  return sharp(raw.data, {
    raw: {
      width: raw.info.width,
      height: raw.info.height,
      channels: raw.info.channels,
    },
  }).png().toBuffer();
}

async function fullOverlayAsset(config, width, height, opacityPercent) {
  const resized = await sharp(config.watermark.logoPath)
    .resize({ width, height, fit: 'fill' })
    .ensureAlpha()
    .png()
    .toBuffer();
  return applyOpacity(resized, opacityPercent);
}

async function watermarkBuffer(source, config, opacityPercent) {
  if (!(await logoExists(config))) {
    throw new Error('The configured watermark asset is missing. Add it to the configured path and redeploy.');
  }

  const normalized = await sharp(source).rotate().png().toBuffer({ resolveWithObject: true });
  const metadata = normalized.info;
  if (!metadata.width || !metadata.height) throw new Error('That image could not be read.');

  if (config.watermark.style === 'x-text') {
    const overlay = xTextOverlay(metadata.width, metadata.height, config.watermark.text, opacityPercent);
    return sharp(normalized.data).composite([{ input: overlay, left: 0, top: 0 }]).png().toBuffer();
  }

  if (config.watermark.style === 'full-overlay') {
    const overlay = await fullOverlayAsset(config, metadata.width, metadata.height, opacityPercent);
    return sharp(normalized.data).composite([{ input: overlay, left: 0, top: 0 }]).png().toBuffer();
  }

  const logoWidth = Math.max(80, Math.round(metadata.width * 0.22));
  const resizedLogo = await sharp(config.watermark.logoPath)
    .resize({ width: logoWidth, withoutEnlargement: true })
    .ensureAlpha()
    .png()
    .toBuffer();
  const logoData = await applyOpacity(resizedLogo, opacityPercent);
  const logoInfo = await sharp(logoData).metadata();
  const location = positionFor(config, metadata, logoInfo);

  return sharp(normalized.data)
    .composite([{ input: logoData, left: Math.max(0, location.left), top: Math.max(0, location.top) }])
    .png()
    .toBuffer();
}

async function watermarkAttachment(attachment, config, opacityPercent) {
  const source = await downloadImage(attachment);
  const output = await watermarkBuffer(source, config, opacityPercent);
  const baseName = path.parse(attachment.name || 'image').name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 60);
  return new AttachmentBuilder(output, { name: (baseName || 'image') + '-watermarked.png' });
}

async function handleWatermarkCommand(interaction, config) {
  if (!(await requireAdmin(interaction, config, 'use the watermark engine'))) return;
  if (interaction.channelId !== config.channels.watermark) {
    await interaction.reply({
      content: 'Use this command in <#' + config.channels.watermark + '>.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const attachment = interaction.options.getAttachment('image', true);
    const opacity = interaction.options.getInteger('opacity') || config.watermark.opacityPercent;
    const result = await watermarkAttachment(attachment, config, opacity);
    await interaction.editReply({ content: 'Watermark added.', files: [result] });
  } catch (error) {
    await interaction.editReply({ content: error.message || 'The image could not be watermarked.' });
  }
}

async function handleAutomaticWatermark(message, config) {
  if (!config.watermark.autoEnabled || !message.guild || !message.author) return false;
  if (message.author.id === message.client.user.id) return false;

  const isEngineChannel = message.channelId === config.channels.watermark;
  const isPickChannel = config.picks.channelIds.includes(message.channelId);
  if (!isEngineChannel && !isPickChannel) return false;
  if (isEngineChannel && !isAdminMember(message.member, config)) return false;
  if (isPickChannel && !config.picks.posterUserIds.includes(message.author.id)) return false;
  if (message.attachments.size === 0) return false;

  const images = [...message.attachments.values()].filter((item) => SUPPORTED_TYPES.has(item.contentType)).slice(0, 5);
  if (images.length === 0) return false;

  if (!(await logoExists(config))) {
    if (isEngineChannel) {
      await message.reply({
        content: 'The configured watermark asset is not ready. Check the watermark settings and redeploy.',
        allowedMentions: { repliedUser: false, parse: [] },
      }).catch(() => null);
    }
    return false;
  }

  try {
    const files = [];
    for (const attachment of images) {
      files.push(await watermarkAttachment(attachment, config, config.watermark.opacityPercent));
    }
    const originalContent = String(message.content || '').trim();
    const pickContent = originalContent
      ? originalContent.slice(0, 1900)
      : 'Official Boardroom Bets pick from <@' + message.author.id + '>.';
    await message.channel.send({
      content: isPickChannel ? pickContent : 'Watermarked and ready to post.',
      files,
      allowedMentions: { parse: [] },
    });
    if (config.watermark.deleteOriginal && message.deletable) {
      await message.delete().catch((error) => console.warn('Could not remove original watermark upload:', error.message));
    }
  } catch (error) {
    if (isEngineChannel) {
      await message.reply({
        content: error.message || 'The image could not be watermarked.',
        allowedMentions: { repliedUser: false, parse: [] },
      }).catch(() => null);
    } else {
      console.error('Automatic pick watermark failed:', error);
    }
  }
  return true;
}

module.exports = { handleAutomaticWatermark, handleWatermarkCommand, logoExists, watermarkBuffer };
