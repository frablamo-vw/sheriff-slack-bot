# Sheriff Slack Bot

A scheduled Node.js job that rotates the sheriff role among members of a private Slack channel. The bot announces the selected person with a direct mention. It does not create an `@sheriff` label because that requires a workspace user group.

If the next person has a configured vacation status, the bot selects the next available person without removing the unavailable person or moving them behind other pending candidates. For example, `[A, B, C]` with A on vacation selects B and changes the queue to `[A, C, B]`.

## How It Works

1. Read all members of the configured private channel.
2. Exclude apps, bots, Slackbot, and deactivated accounts.
3. Reconcile the queue by removing former channel members and appending new members.
4. Check each candidate's Slack custom status.
5. Select the first person without a matching vacation status.
6. Mention the sheriff and any deferred candidates in the announcement channel.
7. Save the new order in `data/rotation.json`.

If everyone is unavailable, the bot retains the queue and posts an explanation. By default, a successful assignment can run only once per ISO week in the configured timezone.

## Slack Setup

The app requires these OAuth scopes:

- `chat:write`
- `groups:read`
- `users:read`
- `users.profile:read`

Reinstall the app in the workspace after adding or changing scopes.

Invite `@KPML Sheriff` to the private candidate channel:

```text
/invite @KPML Sheriff
```

The bot must also be a member of the private announcement channel. The candidate and announcement channels are independent and normally have different channel IDs.

## GitHub Setup

In **Settings > Secrets and variables > Actions**, create this secret:

| Name | Value |
| --- | --- |
| `SLACK_TOKEN` | Bot OAuth token, usually beginning with `xoxb-` |

Create these variables:

| Name | Required | Test value |
| --- | --- | --- |
| `SLACK_SOURCE_CHANNEL_ID` | Yes | ID of `#kpml-sheriff-candidates`, used to read candidates |
| `SLACK_CHANNEL_ID` | Yes | ID of `#kpml-offtopic`, used to publish announcements |
| `SHERIFF_RESPONSIBILITIES_URL` | Yes | Notion responsibilities page URL |
| `ROTATION_TIME_ZONE` | No | `Europe/Madrid` (default: `UTC`) |
| `VACATION_STATUS_EMOJIS` | No | `:palm_tree:,:airplane:` |
| `VACATION_STATUS_TEXT` | No | `vacation,holiday,out of office,ooo,pto` |

Channel IDs begin with `C`. Open each channel's details and copy its channel ID. Configure the candidate and announcement channels separately:

```text
SLACK_SOURCE_CHANNEL_ID=C0123456789
SLACK_CHANNEL_ID=C9876543210
SHERIFF_RESPONSIBILITIES_URL=https://www.notion.so/...
```

Vacation markers are comma-separated and case-insensitive. Expired Slack statuses are ignored, and text markers can appear anywhere in the status text.

In **Settings > Actions > General > Workflow permissions**, select **Read and write permissions**. The workflow persists the new queue by committing `data/rotation.json`, so branch protection rules must permit that commit.

## Run a Live Test

1. Confirm that the bot is a member of `#kpml-sheriff-candidates`.
2. Reinstall the app if you recently changed its scopes.
3. Configure the GitHub secret and variables listed above.
4. Open **Actions > Rotate sheriff**.
5. Select **Run workflow**.

The bot reads candidates from `#kpml-sheriff-candidates` and posts the message in `#kpml-offtopic`. It must be invited to both private channels.

The workflow runs every Monday at 09:00 UTC. GitHub may delay scheduled runs by several minutes. `ROTATION_TIME_ZONE` determines the local week used to prevent duplicate assignments.

## Local Development

Node.js 22 or later is required:

```sh
npm install
npm test
```

For a live local run, export the required environment variables before starting the bot:

```sh
export SLACK_TOKEN="xoxb-your-token"
export SLACK_SOURCE_CHANNEL_ID="C0123456789"
export SLACK_CHANNEL_ID="C9876543210"
export SHERIFF_RESPONSIBILITIES_URL="https://www.notion.so/..."
export ROTATION_TIME_ZONE="Europe/Madrid"
```

`SLACK_SOURCE_CHANNEL_ID` and `SLACK_CHANNEL_ID` must contain Slack channel IDs, not channel names. They do not need to match: the source channel defines the candidates, while the other channel receives the announcements.

To run repeated local tests within the same week, additionally export `ALLOW_REPEAT_WITHIN_WEEK=true`. Do not set it in production.

Then run:

```sh
npm start
```
