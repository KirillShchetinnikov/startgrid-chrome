export function getCascadeGroupIndexes(items, mode) {
  if (mode !== 'rows') return items.map((item, index) => index);

  let currentRow = -1;
  let previousTop = null;

  return items.map(item => {
    if (previousTop === null || Math.abs(item.offsetTop - previousTop) > 1) {
      currentRow += 1;
      previousTop = item.offsetTop;
    }
    return currentRow;
  });
}

export function calculateCascadeTiming(items, mode, duration) {
  const groupIndexes = getCascadeGroupIndexes(items, mode);
  const lastGroupIndex = Math.max(0, ...groupIndexes);
  const itemDuration = Math.round(duration * 0.64);
  const delayBudget = duration - itemDuration;
  const delayStep = lastGroupIndex ? delayBudget / lastGroupIndex : 0;

  return {
    itemDuration,
    delays: groupIndexes.map(groupIndex => groupIndex * delayStep)
  };
}
