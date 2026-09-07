import { readFile, writeFile } from "node:fs/promises";
import { WebClient } from "@slack/web-api";
import {
  eligibleMembers,
  isOnVacation,
  parseMarkerList,
  reconcileQueue,
  rotate,
  rotationWeek,
} from "./rotation.js";

const STATE_PATH = new URL("../data/rotation.json", import.meta.url);

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function commaSeparated(name, fallback = "") {
  return parseMarkerList(process.env[name], fallback);
}

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { queue: [], lastAssignedWeek: null };
    throw error;
  }
}

function assignmentMessage(selected, deferred, responsibilitiesUrl) {
  const delayed = deferred.length
    ? `\n\nVacation shuffle: ${deferred.map((user) => `<@${user}>`).join(", ")} will keep their place in the rotation.`
    : "";
  return `A new role has been assigned to you, <@${selected}>!\n\nHere are your responsibilities for the week: ${responsibilitiesUrl}\n\nGood luck, Sheriff!${delayed}`;
}

async function channelMemberIds(slack, channel) {
  const members = [];
  let cursor;

  do {
    const response = await slack.conversations.members({ channel, cursor, limit: 200 });
    members.push(...(response.members ?? []));
    cursor = response.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return members;
}

async function main() {
  const config = {
    token: requiredEnvironment("SLACK_TOKEN"),
    sourceChannel: requiredEnvironment("SLACK_SOURCE_CHANNEL_ID"),
    channel: requiredEnvironment("SLACK_CHANNEL_ID"),
    responsibilitiesUrl: requiredEnvironment("SHERIFF_RESPONSIBILITIES_URL"),
    timeZone: process.env.ROTATION_TIME_ZONE?.trim() || "UTC",
    markers: {
      emojis: commaSeparated(
        "VACATION_STATUS_EMOJIS",
        ":palm_tree:,:beach_with_umbrella:,:desert_island:,:airplane:",
      ),
      text: commaSeparated("VACATION_STATUS_TEXT", "vacation,holiday,out of office,ooo,pto"),
    },
  };
  const week = rotationWeek(new Date(), config.timeZone);
  const state = await readState();
  const allowRepeatWithinWeek = process.env.ALLOW_REPEAT_WITHIN_WEEK === "true";

  if (!allowRepeatWithinWeek && state.lastAssignedWeek === week) {
    console.log(`Sheriff already assigned for ${week}; nothing to do.`);
    return;
  }

  const slack = new WebClient(config.token);
  const channelMembers = await channelMemberIds(slack, config.sourceChannel);
  const users = await Promise.all(
    channelMembers.map(async (user) => (await slack.users.info({ user })).user),
  );
  const members = eligibleMembers(users.filter(Boolean));
  const queue = reconcileQueue(state.queue, members);
  if (queue.length === 0) throw new Error("The source channel has no eligible human members.");

  const usersById = new Map(users.filter(Boolean).map((user) => [user.id, user]));
  const unavailable = new Set(
    queue.filter((user) => isOnVacation(usersById.get(user)?.profile ?? {}, config.markers)),
  );

  console.log(`Vacation emoji markers: ${[...config.markers.emojis].join(", ") || "(none)"}`);
  console.log(`Vacation text markers: ${[...config.markers.text].join(", ") || "(none)"}`);
  for (const user of queue) {
    const profile = usersById.get(user)?.profile ?? {};
    const status = `${profile.status_emoji || "-"} ${profile.status_text || "-"}`.trim();
    console.log(`  ${unavailable.has(user) ? "[vacation]" : "[available]"} ${user} status: ${status}`);
  }

  const result = rotate(queue, unavailable);

  if (!result.selected) {
    await slack.chat.postMessage({
      channel: config.channel,
      text: "No sheriff was assigned this week because every candidate has a vacation status.",
    });
    console.log("Everyone is unavailable; the queue was retained.");
    return;
  }

  await slack.chat.postMessage({
    channel: config.channel,
    text: assignmentMessage(result.selected, result.deferred, config.responsibilitiesUrl),
  });
  await writeFile(
    STATE_PATH,
    `${JSON.stringify({ queue: result.queue, lastAssignedWeek: week }, null, 2)}\n`,
  );
  console.log(`Assigned ${result.selected} as sheriff for ${week}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
