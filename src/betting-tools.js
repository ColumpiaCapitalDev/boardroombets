const { EmbedBuilder, MessageFlags } = require('discord.js');

const PLAY_TOPICS = Object.freeze({
  basics: {
    title: 'How to Follow a Posted Pick',
    description: 'Match the sport, matchup, market, line, and odds before confirming the wager. Do not force a play after the line moves significantly.',
    fields: [
      { name: 'Straight bets', value: 'Play the selection by itself unless the post clearly labels it as a parlay.' },
      { name: 'Stake', value: 'Use the posted unit size. If none is listed, use your normal standard unit.' },
      { name: 'Final check', value: 'Recheck every selection and price on the bet slip before submitting.' },
    ],
  },
  units: {
    title: 'Understanding Units',
    description: 'A unit is a consistent percentage of your dedicated betting bankroll. It lets members follow the same risk level without using the same dollar amount.',
    fields: [
      { name: 'Standard approach', value: 'Many bettors use 1% of their bankroll as one standard unit.' },
      { name: 'Consistency', value: 'Avoid changing unit size because of one win, one loss, or a confidence boost.' },
      { name: 'Review schedule', value: 'Recalculate at planned intervals instead of after every wager.' },
    ],
  },
  odds: {
    title: 'Reading American Odds',
    description: 'Negative odds show the risk needed to win 100 units. Positive odds show the profit returned on a 100-unit stake.',
    fields: [
      { name: 'Negative price', value: 'At -110, a winning stake returns about 0.91 units of profit for every 1 unit risked.' },
      { name: 'Positive price', value: 'At +150, a winning stake returns 1.5 units of profit for every 1 unit risked.' },
      { name: 'Line movement', value: 'A much worse price can turn a good play into a pass. Compare available books when possible.' },
    ],
  },
  parlays: {
    title: 'Parlay Discipline',
    description: 'Parlays pay more because every leg must win. That creates much higher variance than a straight bet.',
    fields: [
      { name: 'Smaller exposure', value: 'Keep parlay stakes below a normal straight-bet unit unless the posted play says otherwise.' },
      { name: 'Verify every leg', value: 'Confirm each market and line before submitting the slip.' },
      { name: 'Do not chase', value: 'Avoid adding legs or raising the stake to recover earlier losses.' },
    ],
  },
});

function footer(config) {
  return { text: config.serverName + ' • Educational only • No play is guaranteed' };
}

function playHelpPayload(config, topic = 'basics') {
  const selected = PLAY_TOPICS[topic] || PLAY_TOPICS.basics;
  return {
    embeds: [new EmbedBuilder().setColor(config.brandColor).setTitle(selected.title).setDescription(selected.description).addFields(selected.fields).setFooter(footer(config))],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  };
}

function bankrollGuidePayload(config) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle('Bankroll Management Guide')
        .setDescription('Your bankroll is the money you have intentionally separated for sports betting. It should never include money needed for bills or everyday life.')
        .addFields(
          { name: '1. Define the bankroll', value: 'Choose a dedicated betting budget you can afford to lose without affecting real-life obligations.' },
          { name: '2. Find your unit', value: 'A common standard unit is 1% of the bankroll. Use `/bankroll calculate` for a private calculation.' },
          { name: '3. Stay consistent', value: 'Use the same unit system across standard plays and only resize at planned checkpoints.' },
          { name: '4. Never chase', value: 'Do not suddenly increase risk after losses. A losing stretch is not a reason to abandon the plan.' },
          { name: '5. Track results', value: 'Record the market, odds, stake, result, and units won or lost so decisions are based on evidence.' },
          { name: '6. Think long term', value: 'More bets do not automatically create more profit. Selectivity and discipline protect the bankroll.' }
        )
        .setFooter(footer(config)),
    ],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  };
}

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function bankrollCalculationPayload(config, balance, percent) {
  const unit = balance * (percent / 100);
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle('Private Unit-Size Calculation')
        .addFields(
          { name: 'Bankroll', value: money(balance), inline: true },
          { name: 'Unit percentage', value: percent.toFixed(2).replace(/\.00$/, '') + '%', inline: true },
          { name: '1 unit', value: money(unit), inline: true },
          { name: 'Common sizing', value: '0.5u: ' + money(unit * 0.5) + '\n1u: ' + money(unit) + '\n1.5u: ' + money(unit * 1.5) + '\n2u: ' + money(unit * 2) }
        )
        .setFooter(footer(config)),
    ],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  };
}

function oddsCalculationPayload(config, american, stake) {
  const profit = american > 0 ? stake * (american / 100) : stake * (100 / Math.abs(american));
  const probability = american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100);
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(config.brandColor)
        .setTitle('Private Odds Calculation')
        .addFields(
          { name: 'American odds', value: (american > 0 ? '+' : '') + american, inline: true },
          { name: 'Stake', value: money(stake), inline: true },
          { name: 'Potential profit', value: money(profit), inline: true },
          { name: 'Total return', value: money(stake + profit), inline: true },
          { name: 'Implied probability', value: (probability * 100).toFixed(2) + '%', inline: true }
        )
        .setFooter(footer(config)),
    ],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  };
}

async function handleBettingCommand(interaction, config) {
  if (interaction.commandName === 'playhelp') {
    await interaction.reply(playHelpPayload(config, interaction.options.getString('topic') || 'basics'));
    return true;
  }
  if (interaction.commandName === 'bankroll') {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'guide') await interaction.reply(bankrollGuidePayload(config));
    else await interaction.reply(bankrollCalculationPayload(config, interaction.options.getNumber('balance', true), interaction.options.getNumber('unit_percent', true)));
    return true;
  }
  if (interaction.commandName === 'odds') {
    const american = interaction.options.getInteger('american', true);
    if (american === 0) {
      await interaction.reply({ content: 'American odds cannot be zero.', flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.reply(oddsCalculationPayload(config, american, interaction.options.getNumber('stake', true)));
    return true;
  }
  return false;
}

async function handleBettingButton(interaction, config) {
  if (!interaction.isButton()) return false;
  if (interaction.customId === 'boardroom_pick:read') {
    await interaction.reply(playHelpPayload(config, 'basics'));
    return true;
  }
  if (interaction.customId === 'boardroom_pick:bankroll') {
    await interaction.reply(bankrollGuidePayload(config));
    return true;
  }
  return false;
}

module.exports = {
  PLAY_TOPICS,
  bankrollCalculationPayload,
  bankrollGuidePayload,
  handleBettingButton,
  handleBettingCommand,
  oddsCalculationPayload,
  playHelpPayload,
};
