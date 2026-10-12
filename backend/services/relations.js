const { Block } = require("../models/Safety");

// Every user id hidden from `userId`: people they blocked and people who
// blocked them.
async function hiddenIds(userId) {
  const rows = await Block.find({
    $or: [{ blocker: userId }, { blocked: userId }],
  }).select("blocker blocked");
  return rows.map((r) =>
    String(r.blocker) === String(userId) ? r.blocked : r.blocker,
  );
}

async function isBlockedEitherWay(a, b) {
  return !!(await Block.exists({
    $or: [
      { blocker: a, blocked: b },
      { blocker: b, blocked: a },
    ],
  }));
}

module.exports = { hiddenIds, isBlockedEitherWay };
