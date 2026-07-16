const FINAL_FRAME = {
  opacity: 1,
  transform: 'none',
  filter: 'blur(0)'
};

export function getBackgroundEntranceKeyframes(effect) {
  const initialFrames = {
    zoom: {
      opacity: 0,
      transform: 'scale(1.08)'
    },
    blur: {
      opacity: 0,
      transform: 'scale(1.04)',
      filter: 'blur(18px)'
    },
    slide: {
      opacity: 0,
      transform: 'translateY(4%) scale(1.04)'
    }
  };

  return initialFrames[effect]
    ? [initialFrames[effect], FINAL_FRAME]
    : null;
}
