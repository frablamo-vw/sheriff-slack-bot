export function reconcileQueue(queue, members) {
  const memberSet = new Set(members);
  const reconciled = queue.filter((user) => memberSet.has(user));
  const queued = new Set(reconciled);

  for (const member of members) {
    if (!queued.has(member)) {
      reconciled.push(member);
      queued.add(member);
    }
  }

  return reconciled;
}

export function eligibleMembers(users) {
  return users
    .filter((user) => !user.deleted && !user.is_bot && user.id !== "USLACK")
    .map((user) => user.id);
}

export function rotate(queue, unavailableUsers) {
  const selected = queue.find((user) => !unavailableUsers.has(user));

  if (!selected) {
    return { selected: null, queue: [...queue], deferred: [...queue] };
  }

  return {
    selected,
    queue: [...queue.filter((user) => user !== selected), selected],
    deferred: queue.slice(0, queue.indexOf(selected)),
  };
}

export function isOnVacation(profile, markers, nowSeconds = Date.now() / 1000) {
  if (profile.status_expiration > 0 && profile.status_expiration <= nowSeconds) {
    return false;
  }

  const emoji = (profile.status_emoji ?? "").toLowerCase();
  const text = (profile.status_text ?? "").toLowerCase();

  return markers.emojis.has(emoji) || [...markers.text].some((marker) => text.includes(marker));
}

export function rotationWeek(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const localDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  const day = localDate.getUTCDay() || 7;
  localDate.setUTCDate(localDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(localDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((localDate - yearStart) / 86400000 + 1) / 7);

  return `${localDate.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
