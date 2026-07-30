import { getFolders } from '../api/bookmark';
import { getMessage } from '../i18n';

const id = 'startgrid';

const generateFolderItems = (foldersThree, rootId) => {
  // auxiliary array with parent ids
  // 0 - root level
  const parentIds = ['0'];
  const translateItemTitle = getMessage('btn_save');

  const flatRecursiveFolders = (folders, parentId) => {
    return folders.reduce((accum, current) => {
      // add an item to the context menu
      // to save the bookmark inside the folder item
      if (!parentIds.includes(current.parentId)) {
        // if the current item has not yet been written to the auxiliary array
        // then add the save items and separator to the child items
        accum.push(
          {
            id: `save-${current.parentId}`,
            title: translateItemTitle,
            contexts: ['page'],
            parentId: current.parentId
          },
          {
            id: `separator-${current.parentId}`,
            type: 'separator',
            contexts: ['page'],
            parentId: current.parentId
          }
        );
      }
      // write the property to an auxiliary array
      parentIds.push(current.parentId);

      accum.push({
        id: current.id,
        title: current.title,
        contexts: ['page'],
        parentId
      });
      if (current.children?.length && parentId) {
        accum.push(
          ...flatRecursiveFolders(current.children, current.id)
        );
      }
      return accum;
    }, []);
  };
  return flatRecursiveFolders(foldersThree, rootId);
};

let desiredEnabled = false;
let requestedGeneration = 0;
let appliedGeneration = 0;
let reconcilePromise = null;

function callContextMenus(method, ...args) {
  return new Promise((resolve, reject) => {
    browser.contextMenus[method](...args, result => {
      const error = browser.runtime.lastError;
      if (error) {
        reject(new Error(error.message || String(error)));
        return;
      }
      resolve(result);
    });
  });
}

async function createItems() {
  const foldersThree = await getFolders();
  const linkItems = [
    {
      id,
      title: getMessage('add_bookmark'),
      contexts: ['page']
    },
    {
      id: 'current_folder',
      title: getMessage('save_to_current_folder'),
      contexts: ['page'],
      parentId: id
    },
    {
      id: 'separator',
      type: 'separator',
      contexts: ['page'],
      parentId: id
    },
    ...generateFolderItems(foldersThree, id)
  ];

  for (const item of linkItems) {
    await callContextMenus('create', item);
  }
}

async function reconcileDesiredState() {
  while (appliedGeneration !== requestedGeneration) {
    const generation = requestedGeneration;
    const enabled = desiredEnabled;
    await callContextMenus('removeAll');
    if (enabled) await createItems();
    appliedGeneration = generation;
  }
  return desiredEnabled;
}

function startReconcile() {
  let completedSuccessfully = false;
  const operation = reconcileDesiredState();
  reconcilePromise = operation;
  operation.then(
    () => {
      completedSuccessfully = true;
    },
    () => undefined
  );
  operation.finally(() => {
    if (reconcilePromise === operation) reconcilePromise = null;
    if (completedSuccessfully && appliedGeneration !== requestedGeneration) {
      startReconcile();
    }
  }).catch(() => undefined);
  return operation;
}

function waitForQuiescence() {
  const operation = reconcilePromise || startReconcile();
  return operation.then(() => {
    if (
      appliedGeneration !== requestedGeneration
      || (reconcilePromise && reconcilePromise !== operation)
    ) {
      return waitForQuiescence();
    }
    return desiredEnabled;
  });
}

function requestDesiredState(enabled) {
  desiredEnabled = Boolean(enabled);
  requestedGeneration += 1;
  if (!reconcilePromise) startReconcile();
  return waitForQuiescence();
}

const browserContextMenu = {
  init(isShow) {
    return requestDesiredState(isShow);
  },
  create() {
    return requestDesiredState(true);
  },
  toggle(isShow) {
    return requestDesiredState(isShow);
  }
};

export default browserContextMenu;
