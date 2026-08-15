# Boardroom Bets Discord Bot

Discord community bot for Boardroom Bets. The project uses Node.js 20+, Discord.js, and Sharp.

## Included feature modules

- Member welcomes and automatic roles
- `/guide`, bankroll, odds, play-help, and score commands
- Admin post composer and permanent server panels
- Rules acknowledgement roles
- Private support tickets, transcripts, and ticket reviews
- Pick helper and automatic watermark engine
- Promotion, spam, and outside-server invite moderation
- Manual-ban audit logging
- Runtime feature controls

Features that depend on channels or roles remain disabled until the Boardroom server structure is configured.

## Local setup

1. Copy `.env.example` to `.env`.
2. Add the Discord bot token and Boardroom IDs.
3. Run `npm install`.
4. Run `npm run check`.
5. Run `npm start`.

Never commit `.env` or a Discord token.

## Railway

Start command: `npm start`

Required variables:

```text
DISCORD_TOKEN=
APPLICATION_ID=1537318797399035944
GUILD_ID=1534804205896732703
SERVER_NAME=Boardroom Bets
```

Add channel and role IDs after the server structure is created. Keep dependent feature flags disabled until their required IDs are configured.
