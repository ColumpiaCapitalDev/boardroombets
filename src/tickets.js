const fs = require('fs/promises');
const path = require('path');
const {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { isAdminInteraction, requireAdmin } = require('./auth');
const { buildTicketIntroPayload, buildTicketPanelPayload } = require('./content');

const PANEL_BUTTON_ID = 'boardroom_ticket_open';
const reviewPending = new Set();
const closingTickets = new Set();

function safeFilePart(value) {
  return String(value || 'ticket').toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 70);
}

async function fetchTicketMessages(channel, maximum) {
  const messages = [];
  let before;
  while (messages.length < maximum) {
    const limit = Math.min(100, maximum - messages.length);
    const batch = await channel.messages.fetch({ limit, before });
    if (batch.size === 0) break;
    messages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < limit) break;
  }
  return messages.sort((left, right) => left.createdTimestamp - right.createdTimestamp);
}

function transcriptMessage(message) {
  const timestamp = new Date(message.createdTimestamp).toISOString();
  const author = (message.author.tag || message.author.username || 'Unknown User') + ' (' + message.author.id + ')';
  const parts = ['[' + timestamp + '] ' + author];
  const content = String(message.content || '').trim();
  if (content) parts.push(content.slice(0, 8000));
  for (const attachment of message.attachments.values()) {
    parts.push('[Attachment] ' + attachment.name + ': ' + attachment.url);
  }
  for (const embed of message.embeds) {
    const summary = [embed.title, embed.description, embed.url].filter(Boolean).join(' — ');
    if (summary) parts.push('[Embed] ' + summary.slice(0, 4000));
  }
  if (parts.length === 1) parts.push('[No text content]');
  return parts.join('\n');
}

async function createTicketTranscript(channel, config, openerId) {
  const messages = await fetchTicketMessages(channel, config.ticketTranscriptMaxMessages);
  const createdAt = new Date().toISOString();
  const header = [
    'Boardroom Bets Ticket Transcript',
    'Server: ' + channel.guild.name + ' (' + channel.guild.id + ')',
    'Channel: #' + channel.name + ' (' + channel.id + ')',
    'Opened by: ' + openerId,
    'Archived at: ' + createdAt,
    'Messages: ' + messages.length,
    '',
    '------------------------------------------------------------',
    '',
  ];
  const text = header.concat(messages.map(transcriptMessage)).join('\n\n') + '\n';
  const timestamp = createdAt.replace(/[:.]/g, '-');
  const filename = safeFilePart(channel.name) + '-' + timestamp + '.txt';
  await fs.mkdir(config.ticketTranscriptDir, { recursive: true });
  const filePath = path.join(config.ticketTranscriptDir, filename);
  await fs.writeFile(filePath, text, 'utf8');
  return { buffer: Buffer.from(text, 'utf8'), filePath, filename, messageCount: messages.length };
}

async function archiveTicket(channel, config, openerId, closedById, reviewText) {
  const transcript = await createTicketTranscript(channel, config, openerId);
  const destinationId = config.ticketTranscriptChannelId || config.channels.security;
  const destination = await channel.guild.channels.fetch(destinationId).catch(() => null);
  if (destination && destination.isTextBased()) {
    await destination.send({
      embeds: [
        new EmbedBuilder()
          .setColor(config.brandColor)
          .setTitle('Ticket Transcript')
          .addFields(
            { name: 'Member', value: '<@' + openerId + '>', inline: true },
            { name: 'Closed or archived by', value: '<@' + closedById + '>', inline: true },
            { name: 'Messages', value: String(transcript.messageCount), inline: true },
            { name: 'Ticket', value: '#' + channel.name, inline: true },
            { name: 'Review', value: reviewText || 'No review submitted', inline: true }
          )
          .setTimestamp(),
      ],
      files: [new AttachmentBuilder(transcript.buffer, { name: transcript.filename })],
      allowedMentions: { parse: [] },
    }).catch((error) => console.warn('Could not post ticket transcript:', error.message));
  }
  return transcript;
}

function hasPanelButton(message) {
  return message.author.id === message.client.user.id && message.components.some((row) =>
    row.components.some((component) => component.customId === PANEL_BUTTON_ID)
  );
}

async function securityLog(guild, config, description, title = 'Ticket Activity') {
  const channel = await guild.channels.fetch(config.channels.security).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  await channel.send({
    embeds: [new EmbedBuilder().setColor(config.brandColor).setTitle(title).setDescription(description).setTimestamp()],
    allowedMentions: { parse: [] },
  }).catch(() => null);
}

async function findOpenTicket(guild, config, userId) {
  await guild.channels.fetch();
  return guild.channels.cache.find((channel) =>
    channel.parentId === config.ticketCategoryId && channel.topic === 'boardroom-ticket:' + userId
  ) || null;
}

async function postTicketPanel(guild, config, replaceExisting = false) {
  const channel = await guild.channels.fetch(config.channels.needHelp).catch(() => null);
  if (!channel || !channel.isTextBased()) throw new Error('The Need Help channel could not be found.');

  const recent = await channel.messages.fetch({ limit: 50 });
  const existing = recent.filter(hasPanelButton);
  if (!replaceExisting && existing.size > 0) return existing.first();
  if (replaceExisting && existing.size > 0) {
    await Promise.all(existing.map((message) => message.delete().catch(() => null)));
  }
  return channel.send(buildTicketPanelPayload(config));
}

async function openTicket(interaction, config, featureState) {
  if (!featureState.isEnabled('tickets')) {
    await interaction.reply({ content: 'The help desk is temporarily paused. Please try again later.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const existing = await findOpenTicket(interaction.guild, config, interaction.user.id);
  if (existing) {
    await interaction.editReply({ content: 'You already have an open ticket: <#' + existing.id + '>' });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const botMember = interaction.guild.members.me;
  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 70);
  const permissionOverwrites = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks],
    },
    {
      id: config.roles.admin,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages],
    },
  ];
  if (botMember) {
    permissionOverwrites.push({
      id: botMember.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels],
    });
  }

  const channel = await interaction.guild.channels.create({
    name: 'ticket-' + (safeName || interaction.user.id),
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId,
    topic: 'boardroom-ticket:' + interaction.user.id,
    permissionOverwrites,
    reason: 'Help ticket opened by ' + interaction.user.tag,
  });
  await channel.send(buildTicketIntroPayload(config, member));
  await interaction.editReply({ content: 'Your private ticket is ready: <#' + channel.id + '>' });
  await securityLog(interaction.guild, config, '<@' + member.id + '> opened <#' + channel.id + '>.');
}

function reviewComponents(openerId) {
  const ratingRow = new ActionRowBuilder();
  for (let rating = 1; rating <= 5; rating += 1) {
    ratingRow.addComponents(
      new ButtonBuilder()
        .setCustomId('boardroom_ticket_review:' + openerId + ':' + rating)
        .setLabel(String(rating))
        .setEmoji('⭐')
        .setStyle(rating >= 4 ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
  }
  return [
    ratingRow,
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('boardroom_ticket_skip:' + openerId).setLabel('Close Without Review').setStyle(ButtonStyle.Danger)
    ),
  ];
}

async function finalizeTicket(interaction, config, openerId, reviewText) {
  if (closingTickets.has(interaction.channelId)) return;
  closingTickets.add(interaction.channelId);
  try {
    await archiveTicket(interaction.channel, config, openerId, interaction.user.id, reviewText);
  } catch (error) {
    closingTickets.delete(interaction.channelId);
    reviewPending.delete(interaction.channelId);
    await interaction.channel.send({
      content: 'The transcript could not be archived, so this ticket was left open. An admin can retry with `/ticket transcript`.',
      allowedMentions: { parse: [] },
    }).catch(() => null);
    await securityLog(interaction.guild, config, 'Could not archive **#' + interaction.channel.name + '**.\n`' + error.message + '`', 'Ticket Transcript Failed');
    return;
  }
  reviewPending.delete(interaction.channelId);
  if (reviewText) {
    await securityLog(
      interaction.guild,
      config,
      '<@' + openerId + '> rated **#' + interaction.channel.name + '** ' + reviewText + '.',
      'Ticket Review'
    );
  }
  await securityLog(interaction.guild, config, '<@' + interaction.user.id + '> closed ticket **#' + interaction.channel.name + '**.');
  await interaction.channel.send({ content: 'Ticket closed. This channel will be removed in a few seconds.', allowedMentions: { parse: [] } }).catch(() => null);
  setTimeout(async () => {
    await interaction.channel.delete('Ticket closed by ' + interaction.user.tag).catch(() => null);
    closingTickets.delete(interaction.channelId);
  }, 3000);
}

async function closeTicket(interaction, config, openerId, featureState) {
  if (interaction.user.id !== openerId && !isAdminInteraction(interaction, config)) {
    await interaction.reply({ content: 'Only the ticket owner or an admin can close this ticket.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!featureState.isEnabled('ticketReviews')) {
    await interaction.deferUpdate();
    await finalizeTicket(interaction, config, openerId, null);
    return;
  }
  if (reviewPending.has(interaction.channelId)) {
    await interaction.reply({ content: 'A review request is already open in this ticket.', flags: MessageFlags.Ephemeral });
    return;
  }
  reviewPending.add(interaction.channelId);
  await interaction.reply({
    content: '<@' + openerId + '>',
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle('How was your support experience?')
        .setDescription('Choose a rating from 1 to 5 stars. Your feedback helps Boardroom Bets improve support.')
        .setFooter({ text: 'The ticket closes after a rating is selected' }),
    ],
    components: reviewComponents(openerId),
    allowedMentions: { users: [openerId], roles: [], repliedUser: false },
  });
}

async function handleTicketInteraction(interaction, config, featureState) {
  if (!interaction.isButton()) return false;
  if (interaction.customId === PANEL_BUTTON_ID) {
    await openTicket(interaction, config, featureState);
    return true;
  }
  if (interaction.customId.startsWith('boardroom_ticket_close:')) {
    await closeTicket(interaction, config, interaction.customId.split(':')[1], featureState);
    return true;
  }
  if (interaction.customId.startsWith('boardroom_ticket_review:')) {
    const [, openerId, rating] = interaction.customId.split(':');
    if (interaction.user.id !== openerId) {
      await interaction.reply({ content: 'Only the member who opened this ticket can submit its review.', flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.deferUpdate();
    await finalizeTicket(interaction, config, openerId, '⭐'.repeat(Number(rating)) + ' (' + rating + '/5)');
    return true;
  }
  if (interaction.customId.startsWith('boardroom_ticket_skip:')) {
    const openerId = interaction.customId.split(':')[1];
    if (interaction.user.id !== openerId && !isAdminInteraction(interaction, config)) {
      await interaction.reply({ content: 'Only the ticket owner or an admin can close without a review.', flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.deferUpdate();
    await finalizeTicket(interaction, config, openerId, null);
    return true;
  }
  return false;
}

async function handleTicketPanelCommand(interaction, config, featureState) {
  if (!(await requireAdmin(interaction, config, 'manage support tickets'))) return;
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'transcript') {
    const openerId = String(interaction.channel.topic || '').startsWith('boardroom-ticket:')
      ? interaction.channel.topic.split(':')[1]
      : '';
    if (!openerId) {
      await interaction.reply({ content: 'Use this command inside a Boardroom Bets ticket channel.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const transcript = await archiveTicket(interaction.channel, config, openerId, interaction.user.id, 'Manual archive');
      await interaction.editReply({ content: 'Transcript saved as `' + transcript.filename + '` with ' + transcript.messageCount + ' messages.' });
    } catch (error) {
      await interaction.editReply({ content: error.message || 'The ticket transcript could not be saved.' });
    }
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    if (!featureState.isEnabled('tickets')) throw new Error('Support tickets are currently paused with /features.');
    const message = await postTicketPanel(interaction.guild, config, true);
    await interaction.editReply({ content: 'Ticket panel posted: ' + message.url });
  } catch (error) {
    await interaction.editReply({ content: error.message || 'The ticket panel could not be posted.' });
  }
}

module.exports = { handleTicketInteraction, handleTicketPanelCommand, postTicketPanel };
