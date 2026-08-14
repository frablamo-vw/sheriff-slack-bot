import test from "node:test";
import assert from "node:assert/strict";
import { eligibleMembers, isOnVacation, reconcileQueue, rotate, rotationWeek } from "../src/rotation.js";

test("selects the queue head and moves them to the end", () => {
  assert.deepEqual(rotate(["A", "B", "C"], new Set()), {
    selected: "A",
    queue: ["B", "C", "A"],
    deferred: [],
  });
});

test("keeps vacationing users at the front while rotating the selected user", () => {
  assert.deepEqual(rotate(["A", "B", "C"], new Set(["A"])), {
    selected: "B",
    queue: ["A", "C", "B"],
    deferred: ["A"],
  });

  assert.deepEqual(rotate(["A", "C", "B"], new Set(["A"])), {
    selected: "C",
    queue: ["A", "B", "C"],
    deferred: ["A"],
  });
});

test("assigns a deferred user as soon as they return", () => {
  assert.deepEqual(rotate(["A", "C", "B"], new Set()), {
    selected: "A",
    queue: ["C", "B", "A"],
    deferred: [],
  });
});

test("does not change the queue when everyone is unavailable", () => {
  assert.deepEqual(rotate(["A", "B"], new Set(["A", "B"])), {
    selected: null,
    queue: ["A", "B"],
    deferred: ["A", "B"],
  });
});

test("removes former members and appends new members", () => {
  assert.deepEqual(reconcileQueue(["B", "A", "OLD"], ["A", "B", "NEW"]), ["B", "A", "NEW"]);
});

test("keeps only active human channel members", () => {
  const users = [
    { id: "ACTIVE" },
    { id: "DELETED", deleted: true },
    { id: "BOT", is_bot: true },
    { id: "USLACK" },
  ];

  assert.deepEqual(eligibleMembers(users), ["ACTIVE"]);
});

test("detects active vacation statuses by emoji or text", () => {
  const markers = { emojis: new Set([":palm_tree:"]), text: new Set(["vacation", "ooo"]) };

  assert.equal(isOnVacation({ status_emoji: ":palm_tree:", status_text: "" }, markers, 100), true);
  assert.equal(isOnVacation({ status_emoji: "", status_text: "On VACATION" }, markers, 100), true);
  assert.equal(
    isOnVacation({ status_emoji: ":palm_tree:", status_text: "Vacation", status_expiration: 99 }, markers, 100),
    false,
  );
  assert.equal(isOnVacation({ status_emoji: ":coffee:", status_text: "Focused" }, markers, 100), false);
});

test("calculates ISO weeks in the configured timezone", () => {
  const instant = new Date("2026-01-05T00:30:00Z");

  assert.equal(rotationWeek(instant, "UTC"), "2026-W02");
  assert.equal(rotationWeek(instant, "America/Los_Angeles"), "2026-W01");
});
