import { getMessage } from '../i18n';

export function createEmptyState(search = false, allowCreate = true) {
  const panel = document.createElement('section');
  panel.className = search ? 'empty-state empty-search' : 'empty-state';
  const heading = document.createElement('h2');
  heading.textContent = getMessage(search ? 'empty_search' : 'empty_folder_title');
  const text = document.createElement('p');
  text.textContent = getMessage(search ? 'empty_search_hint' : 'empty_folder_hint');
  panel.append(heading, text);
  if (search || allowCreate) {
    const button = document.createElement('button');
    button.className = 'btn';
    button.type = 'button';
    button.textContent = getMessage(search ? 'clear_search' : 'new_bookmark');
    if (search) button.dataset.emptySearchReset = '';
    else {
      button.id = 'add'; button.dataset.create = 'New';
    }
    panel.append(button);
  }
  return panel;
}
