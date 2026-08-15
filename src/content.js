const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { channelUrl } = require('./config');

function navigationRows(config) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Rules').setStyle(ButtonStyle.Link).setURL(channelUrl(config.channels.rules)),
      new ButtonBuilder().setLabel('Free Chat').setStyle(ButtonStyle.Link).setURL(channelUrl(config.channels.freeChat)),
      new ButtonBuilder().setLabel('Announcements').setStyle(ButtonStyle.Link).setURL(channelUrl(config.channels.announcements)),
      new ButtonBuilder().setLabel('Bankroll Guide').setStyle(ButtonStyle.Link).setURL(channelUrl(config.channels.bankroll))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Gain Access').setStyle(ButtonStyle.Link).setURL(channelUrl(config.channels.gainAccess)),
      new ButtonBuilder().setLabel('Boardroom VIP').setStyle(ButtonStyle.Link).setURL(config.premiumUrl),
      new ButtonBuilder().setLabel('Need Help').setStyle(ButtonStyle.Link).setURL(channelUrl(config.channels.needHelp)),
      new ButtonBuilder().setLabel('Socials').setStyle(ButtonStyle.Link).setURL(channelUrl(config.channels.socials))
    ),
  ];
}

function ordinal(value) {
  const number = Math.max(0, Number(value) || 0);
  const tens = number % 100;
  const suffix = tens >= 11 && tens <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' }[number % 10] || 'th');
  return number.toLocaleString('en-US') + suffix;
}

function buildWelcomePayload(config, member) {
  const displayName = member && member.displayName ? member.displayName : 'there';
  const memberNumber = ordinal(member && member.guild ? member.guild.memberCount : 0);
  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle('Welcome to the Boardroom')
    .setDescription('Get settled, learn how the room works, and choose the level of access that fits you.')
    .addFields(
      {
        name: 'Start Here',
        value:
          'Server walkthrough: use `/guide`\n' +
          'Community rules: <#' + config.channels.rules + '>\n' +
          "Come say what's up: <#" + config.channels.freeChat + '>',
      },
      {
        name: 'Unlock the Picks',
        value:
          'Winible is the official way to unlock Boardroom VIP.\n' +
          'View the Boardroom: [Open Winible](' + config.premiumUrl + ')\n' +
          'After joining, connect your access: <#' + config.channels.gainAccess + '>',
      },
      {
        name: 'Need Anything?',
        value:
          'Support: <#' + config.channels.needHelp + '>\n' +
          'Announcements: <#' + config.channels.announcements + '>\n' +
          'Official socials: <#' + config.channels.socials + '>',
      },
      { name: 'The Room', value: 'Free picks: <#' + config.channels.freePicks + '>\nVIP card: <#' + config.channels.boardroomPicks + '>\nOfficial site: [boardroombets.com](' + config.links.website + ')' }
    )
    .setFooter({ text: 'You are the ' + memberNumber + ' member to join! • Boardroom Bets' });

  return {
    content: member ? 'Welcome to Boardroom Bets <@' + member.id + '>!' : 'Welcome to Boardroom Bets, ' + displayName + '!',
    embeds: [embed],
    components: navigationRows(config),
    allowedMentions: member
      ? { users: [member.id], roles: [], repliedUser: false }
      : { parse: [] },
  };
}

function buildGuidePayload(config) {
  const embed = new EmbedBuilder()
    .setColor(config.brandColor)
    .setTitle(config.serverName + ' Server Guide')
    .setDescription('Everything you need is organized below. Use the buttons to jump directly to the right place.')
    .addFields(
      { name: 'Start Here', value: '<#' + config.channels.rules + '>\n<#' + config.channels.announcements + '>\n<#' + config.channels.bankroll + '>\n<#' + config.channels.needHelp + '>', inline: true },
      { name: 'The Plays', value: '<#' + config.channels.freePicks + '>\n<#' + config.channels.boardroomPicks + '>\n<#' + config.channels.freeChat + '>\n<#' + config.channels.wins + '>', inline: true },
      { name: 'Unlock & Connect', value: '<#' + config.channels.gainAccess + '>\n<#' + config.channels.premium + '>\n<#' + config.channels.socials + '>\n[Boardroom VIP](' + config.premiumUrl + ')', inline: true }
    )
    .setFooter({ text: 'Boardroom Bets • Use /guide whenever you need directions' });

  return {
    embeds: [embed],
    components: navigationRows(config),
    allowedMentions: { parse: [] },
  };
}

function buildTicketPanelPayload(config) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle('Boardroom Bets Help Desk')
        .setDescription('Need help with access, membership, billing, or the server? Open a private ticket and tell the team what you need.')
        .setFooter({ text: 'One open ticket per member • Please include useful details' }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('boardroom_ticket_open')
          .setLabel('Open a Ticket')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary)
      ),
    ],
    allowedMentions: { parse: [] },
  };
}

function buildTicketIntroPayload(config, member) {
  return {
    content: '<@' + member.id + '> <@&' + config.roles.admin + '>',
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle('How can we help?')
        .setDescription(
          'Tell us what you need help with and include any relevant screenshots, order details, or error messages. A Boardroom Bets admin will review this ticket.'
        )
        .setFooter({ text: 'Use Close Ticket when the issue is resolved' }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('boardroom_ticket_close:' + member.id)
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
      ),
    ],
    allowedMentions: { users: [member.id], roles: [config.roles.admin], repliedUser: false },
  };
}

module.exports = {
  buildGuidePayload,
  buildTicketIntroPayload,
  buildTicketPanelPayload,
  buildWelcomePayload,
};
