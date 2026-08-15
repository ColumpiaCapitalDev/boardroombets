const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { requireAdmin } = require('./auth');

function parseColor(value, fallback) {
  const normalized = String(value || '').trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;
  return Number.parseInt(normalized, 16);
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function input(customId, label, style, required, placeholder, maxLength) {
  return new LabelBuilder()
    .setLabel(label)
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(customId)
        .setStyle(style)
        .setRequired(required)
        .setPlaceholder(placeholder)
        .setMaxLength(maxLength)
    );
}

async function openPostComposer(interaction, config) {
  if (!(await requireAdmin(interaction, config, 'open the post composer'))) return;
  if (interaction.channelId !== config.channels.admin) {
    await interaction.reply({
      content: 'Use the post composer in <#' + config.channels.admin + '> so staff controls stay private.',
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
    return;
  }

  const target = interaction.options.getChannel('channel', true);
  if (!target.isTextBased() || target.guildId !== config.guildId) {
    await interaction.reply({ content: 'Choose a text channel in this server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('hoodie_post:' + interaction.user.id + ':' + target.id)
    .setTitle('Post to #' + target.name)
    .addLabelComponents(
      input('title', 'Title (optional)', TextInputStyle.Short, false, 'New Boardroom Bets update', 256),
      input('body', 'Message', TextInputStyle.Paragraph, true, 'Write the full post here…', 4000),
      input('color', 'Embed color (optional)', TextInputStyle.Short, false, '#F5A300', 7),
      input('button_label', 'Button label (optional)', TextInputStyle.Short, false, 'Learn More', 80),
      input('button_url', 'Button link (optional)', TextInputStyle.Short, false, 'https://example.com', 512)
    );

  await interaction.showModal(modal);
}

async function submitPostComposer(interaction, config) {
  if (!interaction.customId.startsWith('hoodie_post:')) return false;
  if (!(await requireAdmin(interaction, config, 'publish server posts'))) return true;

  const [, ownerId, channelId] = interaction.customId.split(':');
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'This composer belongs to another admin.', flags: MessageFlags.Ephemeral });
    return true;
  }

  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    await interaction.reply({ content: 'That channel is no longer available.', flags: MessageFlags.Ephemeral });
    return true;
  }

  const title = interaction.fields.getTextInputValue('title').trim();
  const body = interaction.fields.getTextInputValue('body').trim();
  const color = interaction.fields.getTextInputValue('color').trim();
  const buttonLabel = interaction.fields.getTextInputValue('button_label').trim();
  const buttonUrl = interaction.fields.getTextInputValue('button_url').trim();

  if ((buttonLabel && !buttonUrl) || (!buttonLabel && buttonUrl)) {
    await interaction.reply({ content: 'A button needs both a label and a link.', flags: MessageFlags.Ephemeral });
    return true;
  }
  if (buttonUrl && !isHttpUrl(buttonUrl)) {
    await interaction.reply({ content: 'The button link must start with http:// or https://.', flags: MessageFlags.Ephemeral });
    return true;
  }

  const embed = new EmbedBuilder()
    .setColor(parseColor(color, config.brandColor))
    .setDescription(body)
    .setFooter({ text: config.serverName });
  if (title) embed.setTitle(title);

  const payload = { embeds: [embed], allowedMentions: { parse: [] } };
  if (buttonUrl) {
    payload.components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(buttonLabel).setURL(buttonUrl).setStyle(ButtonStyle.Link)
      ),
    ];
  }

  const posted = await channel.send(payload);
  await interaction.reply({
    content: 'Posted successfully: ' + posted.url,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
  return true;
}

module.exports = { openPostComposer, submitPostComposer };
