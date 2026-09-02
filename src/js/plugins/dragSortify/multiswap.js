const DROPZONE_CLASSNAME = '.dropzone-bookmark';
const REORDER_DURATION = 180;

export function multiswap(dnd) {
  const holdDelay = 500;

  let holdTimer = null;
  let draggingCards = [];
  let draggedElement = null;
  let activeDropZone = null;
  let initialItems = [];
  let lastInsertion = null;
  let didReorder = false;
  let completedDrop = false;

  function activateDropZone(dropZone) {
    if (activeDropZone !== dropZone) {
      deactivateDropZone();
      dropZone.classList.add('has-highlight');
      activeDropZone = dropZone;
    }
  }

  function deactivateDropZone() {
    if (activeDropZone) {
      activeDropZone.classList.remove('has-highlight');
      activeDropZone = null;
    }
    clearTimeout(holdTimer);
    holdTimer = null;
  }

  function animateReorder(callback) {
    const before = new Map(
      [...dnd.el.children]
        .filter(item => !draggingCards.includes(item))
        .map(item => [item, item.getBoundingClientRect()])
    );
    callback();

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    before.forEach((rect, item) => {
      const nextRect = item.getBoundingClientRect();
      const translateX = rect.left - nextRect.left;
      const translateY = rect.top - nextRect.top;
      if (!translateX && !translateY) return;
      item.animate([
        { transform: `translate(${translateX}px, ${translateY}px)` },
        { transform: 'translate(0, 0)' }
      ], {
        duration: REORDER_DURATION,
        easing: 'cubic-bezier(0.2, 0, 0, 1)'
      });
    });
  }

  function reorderCards(target, insertBefore) {
    if (draggingCards.includes(target)) return false;
    if (
      lastInsertion?.target === target
      && lastInsertion.insertBefore === insertBefore
    ) return false;

    const reference = insertBefore ? target : target.nextElementSibling;
    if (reference && draggingCards.includes(reference)) return false;

    animateReorder(() => {
      draggingCards.forEach(card => dnd.el.insertBefore(card, reference));
    });
    lastInsertion = { target, insertBefore };
    didReorder = true;
    return true;
  }

  function restoreInitialOrder() {
    if (!didReorder) return;
    animateReorder(() => initialItems.forEach(item => dnd.el.append(item)));
  }

  return {
    dragstart: (e) => {
      if (dnd.isDisabled) {
        return false;
      }

      draggedElement = e.target.closest(dnd.options.draggableSelector);
      if (!draggedElement) return;

      const dragStartCallback = dnd.options?.onDragStart?.({
        event: e,
        draggedElement,
        draggingItems: dnd.draggingItems.length ? dnd.draggingItems : [draggedElement]
      });

      if (dragStartCallback === false) {
        e.preventDefault();
        return;
      }

      initialItems = Array.from(dnd.el.children);
      lastInsertion = null;
      didReorder = false;
      completedDrop = false;

      if (dnd.draggingItems.includes(draggedElement)) {
        draggingCards = [...dnd.draggingItems];
      } else {
        draggingCards = [draggedElement];
      }

      draggingCards.forEach((el) => dnd.toggleDragging(el, true));

      e.dataTransfer.effectAllowed = 'move';
    },
    dragover(e) {
      if (dnd.isIgnoreSelector(e.target) || !draggedElement) {
        return;
      }

      e.preventDefault();

      const closestCard = e.target.closest(dnd.options.draggableSelector);
      const dropZone = e.target.closest(DROPZONE_CLASSNAME);

      if (activeDropZone) {
        return;
      }

      // nested zone activation timer
      if (dropZone && dropZone !== activeDropZone) {
        if (!holdTimer) {
          holdTimer = setTimeout(() => {
            activateDropZone(dropZone);
          }, holdDelay);
          return;
        }
      }

      // Move the transparent source slot while dragging so the surrounding
      // tiles immediately reveal the final order.
      if (closestCard && closestCard !== draggedElement) {
        const rect = closestCard.getBoundingClientRect();
        reorderCards(closestCard, e.clientX < rect.left + rect.width / 2);
      }
      dnd.options?.onDragOver?.(e);
    },
    drop(e) {
      e.preventDefault();

      if (dnd.isIgnoreSelector(e.target)) {
        return;
      }

      const closestCard = e.target.closest(dnd.options.draggableSelector);
      const dropZone = e.target.closest(DROPZONE_CLASSNAME);

      if (dropZone && dropZone === activeDropZone) {
        // inserting all cards into the dropZone
        draggingCards.forEach((card) => {
          const clone = card.cloneNode(true);
          dnd.options?.onAdd?.({
            item: card,
            target: dropZone,
            clone
          });
        });

        deactivateDropZone();
        completedDrop = true;
      } else if (closestCard && !draggingCards.includes(closestCard)) {
        const cardRect = closestCard.getBoundingClientRect();
        const insertBefore = e.clientX < cardRect.left + cardRect.width / 2;
        reorderCards(closestCard, insertBefore);
        completedDrop = true;
      }

      deactivateDropZone();

      dnd.options?.onDrop?.(e);
    },
    dragend(e) {
      draggingCards.forEach((el) => {
        dnd.toggleDragging(el, false);
      });

      const hasNativeDrop = e.dataTransfer?.dropEffect === 'move';
      if (didReorder && (completedDrop || hasNativeDrop)) {
        dnd.options?.onUpdate?.(e);
      } else {
        restoreInitialOrder();
      }
      draggingCards = [];
      deactivateDropZone();
      initialItems = [];
      lastInsertion = null;
      didReorder = false;
      completedDrop = false;

      dnd.options?.onDragEnd?.(e);
      draggedElement = null;
    },
    dragleave(e) {
      if (
        e.relatedTarget &&
        !e.relatedTarget.closest(DROPZONE_CLASSNAME)
      ) {
        deactivateDropZone();
        clearTimeout(holdTimer);
        holdTimer = null;
      }

      dnd.options?.onDragLeave?.(e);
    }
  };
}
