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

The bot must also be a member of the private announcement channel. During testing, `#kpml-sheriff-candidates` can serve as both the candidate and announcement channel.

## GitHub Setup

In **Settings > Secrets and variables > Actions**, create this secret:

| Name | Value |
| --- | --- |
| `SLACK_TOKEN` | Bot OAuth token, usually beginning with `xoxb-` |

Create these variables:

| Name | Required | Test value |
| --- | --- | --- |
| `SLACK_SOURCE_CHANNEL_ID` | Yes | ID of `#kpml-sheriff-candidates` |
| `SLACK_CHANNEL_ID` | Yes | The same `#kpml-sheriff-candidates` ID |
| `SHERIFF_RESPONSIBILITIES_URL` | Yes | Notion responsibilities page URL |
| `ROTATION_TIME_ZONE` | No | `Europe/Madrid` (default: `UTC`) |
| `VACATION_STATUS_EMOJIS` | No | `:palm_tree:,:airplane:` |
| `VACATION_STATUS_TEXT` | No | `vacation,holiday,out of office,ooo,pto` |

Channel IDs begin with `C`. Open the details for `#kpml-sheriff-candidates` and copy its channel ID. To test using one channel, configure:

```text
SLACK_SOURCE_CHANNEL_ID=C0123456789
SLACK_CHANNEL_ID=C0123456789
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

The test message will appear in `#kpml-sheriff-candidates`. When you are ready to announce in `#kpml-offtopic`, invite the bot to that private channel and change only `SLACK_CHANNEL_ID` to the ID of `#kpml-offtopic`.

The workflow is temporarily configured to run every five minutes and allows repeated assignments within the same week through `ALLOW_REPEAT_WITHIN_WEEK=true`. GitHub may delay scheduled runs by several minutes.

For production, change the cron expression in `.github/workflows/rotate-sheriff.yml` to a weekly schedule, such as `0 9 * * 1` for Mondays at 09:00 UTC, and remove `ALLOW_REPEAT_WITHIN_WEEK`. `ROTATION_TIME_ZONE` determines the local week used to prevent duplicate assignments.

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
export SLACK_CHANNEL_ID="C0123456789"
export SHERIFF_RESPONSIBILITIES_URL="https://www.notion.so/..."
export ROTATION_TIME_ZONE="Europe/Madrid"
export ALLOW_REPEAT_WITHIN_WEEK="true"
```

`SLACK_SOURCE_CHANNEL_ID` and `SLACK_CHANNEL_ID` must contain Slack channel IDs, not channel names. During testing, both can use the ID of `#kpml-sheriff-candidates`.

`ALLOW_REPEAT_WITHIN_WEEK=true` allows every local execution to select the next sheriff. Omit it in production to prevent more than one assignment per week.

Then run:

```sh
npm start
```
