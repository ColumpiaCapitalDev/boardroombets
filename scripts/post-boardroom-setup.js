const { Client, GatewayIntentBits } = require('discord.js');
const { config, validateConfig } = require('../src/config');
const { postBoardroomSetup } = require('../src/panels');
const { postTicketPanel } = require('../src/tickets');

validateConfig();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  try {
    const guild = await client.guilds.fetch(config.guildId);
    const panels = await postBoardroomSetup(guild, config);
    const ticketPanel = await postTicketPanel(guild, config, true);
    const result = Object.fromEntries(Object.entries(panels).map(([name, message]) => [name, message.url]));
    result.tickets = ticketPanel.url;
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(config.token);
