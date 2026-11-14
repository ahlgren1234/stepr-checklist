// Interactive demo for @stepr/checklist.
//
// Both imports go through the import map in index.html:
// - '@stepr/checklist' → ../dist/index.js, the built package (run `pnpm build`)
// - 'stepr'            → the separate tour library, a devDependency used only
//                        by this demo. @stepr/checklist does not depend on it.
import { checklistCss, createChecklist } from '@stepr/checklist';
import { createTour } from 'stepr';

const STORAGE_KEY = 'stepr-checklist-demo:onboarding';
const PERSIST_PREF_KEY = 'stepr-checklist-demo:persist';
const MAX_LOG_ENTRIES = 40;

const $ = (selector) => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Demo markup is missing ${selector}`);
  return element;
};

// localStorage can be unavailable or blocked; the demo preference is optional.
const readPref = () => {
  try {
    return localStorage.getItem(PERSIST_PREF_KEY) === 'true';
  } catch {
    return false;
  }
};
const writePref = (persist) => {
  try {
    if (persist) localStorage.setItem(PERSIST_PREF_KEY, 'true');
    else localStorage.removeItem(PERSIST_PREF_KEY);
  } catch {
    // Ignore: the preference just won't survive a reload.
  }
};
const clearSavedProgress = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was saved.
  }
};

// --- Event log --------------------------------------------------------------

const logList = $('#event-log');
const logEmpty = $('#log-empty');

function logEvent(source, message) {
  const item = document.createElement('li');
  const tag = document.createElement('span');
  tag.className = `log__source log__source--${source}`;
  tag.textContent = source;
  const text = document.createElement('span');
  text.textContent = message;
  item.append(tag, text);
  logList.prepend(item);
  while (logList.children.length > MAX_LOG_ENTRIES) {
    logList.lastElementChild?.remove();
  }
  logEmpty.hidden = true;
}

$('#log-clear').addEventListener('click', () => {
  logList.replaceChildren();
  logEmpty.hidden = false;
});

// --- The example app ---------------------------------------------------------

const panels = {
  profile: $('#panel-profile'),
  project: $('#panel-project'),
  invite: $('#panel-invite'),
};
const appEmpty = $('#app-empty');
const projectList = $('#project-list');
let returnFocusTo = null;

function openPanel(name) {
  // Remember the opener (a checklist step or toolbar button) to restore focus.
  returnFocusTo = document.activeElement;
  for (const [key, panel] of Object.entries(panels)) {
    panel.hidden = key !== name;
  }
  appEmpty.hidden = true;
  panels[name].querySelector('input')?.focus();
}

function closePanels(restoreFocus = true) {
  for (const panel of Object.values(panels)) {
    panel.hidden = true;
    panel.reset();
  }
  appEmpty.hidden = projectList.children.length > 0;
  if (
    restoreFocus &&
    returnFocusTo instanceof HTMLElement &&
    returnFocusTo.isConnected
  ) {
    returnFocusTo.focus();
  }
  returnFocusTo = null;
}

for (const panel of Object.values(panels)) {
  panel.querySelector('[data-cancel]')?.addEventListener('click', () => {
    closePanels();
  });
}

$('#app-profile').addEventListener('click', () => openPanel('profile'));
$('#app-new-project').addEventListener('click', () => openPanel('project'));
$('#app-invite').addEventListener('click', () => openPanel('invite'));

// The app completes a step when the work is done, not when the step is opened.
panels.profile.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = new FormData(panels.profile).get('name');
  logEvent('app', `Profile saved for “${String(name)}”`);
  completeAndLog('profile');
  closePanels();
});

panels.project.addEventListener('submit', (event) => {
  event.preventDefault();
  const project = document.createElement('li');
  project.textContent = String(new FormData(panels.project).get('project'));
  projectList.append(project);
  projectList.hidden = false;
  logEvent('app', `Project “${project.textContent}” created`);
  completeAndLog('project');
  closePanels();
});

panels.invite.addEventListener('submit', (event) => {
  event.preventDefault();
  logEvent('app', 'Invite “sent” (nothing leaves this page)');
  completeAndLog('invite');
  closePanels();
});

// --- Stepr integration -------------------------------------------------------
// The checklist step starts the tour from its onClick; the tour's onComplete
// completes the step. Neither library imports the other.

const tour = createTour({
  steps: [
    {
      target: '#app-profile',
      title: 'Your profile',
      description: 'Add your name so teammates know who you are.',
    },
    {
      target: '#app-new-project',
      title: 'Projects',
      description: 'Everything in Acme starts with a project.',
    },
    {
      target: '#app-invite',
      title: 'Invite your team',
      description: 'Acme works better with others.',
    },
    {
      target: '#onboarding',
      title: 'Your checklist',
      description: 'Progress is tracked here. Finish the tour to tick it off.',
    },
  ],
  onComplete: () => {
    logEvent('stepr', 'Tour finished, so the app completes the step');
    completeAndLog('tour');
  },
  onExit: () => {
    logEvent('stepr', 'Tour closed early. The step stays incomplete.');
  },
});

function startTour() {
  closePanels(false); // the tour moves focus itself and restores it afterwards
  if (tour.start()) logEvent('stepr', 'tour.start() → true');
  else logEvent('stepr', 'tour.start() → false: no tour target is visible');
}

// --- The checklist -----------------------------------------------------------

const steps = [
  {
    id: 'profile',
    label: 'Complete your profile',
    onClick: () => openPanel('profile'),
  },
  {
    id: 'project',
    label: 'Create your first project',
    onClick: () => openPanel('project'),
  },
  {
    id: 'invite',
    label: 'Invite a teammate',
    onClick: () => openPanel('invite'),
  },
  {
    id: 'tour',
    label: 'Take the product tour',
    onClick: startTour,
  },
  // No onClick: rendered as text, completed by the app (see "Simulate").
  { id: 'verify', label: 'Verify your email address' },
];

const setupPill = $('#setup-pill');
const doneBanner = $('#done-banner');
const destroyButton = $('#ctl-destroy');
let checklist;
let quiet = false; // suppresses logging while state is carried over
let wasDone = false;

function showProgress({ progress }) {
  const { completed, total } = progress;
  setupPill.textContent = `Setup ${String(completed)}/${String(total)}`;
  const done = total > 0 && completed === total;
  doneBanner.hidden = !done;
  if (done && !wasDone && !quiet) logEvent('onChange', 'All steps complete 🎉');
  wasDone = done;
}

function mount(persist, carryOver) {
  checklist = createChecklist({
    container: '#onboarding',
    title: 'Get started with Acme',
    steps,
    ...(persist && { storageKey: STORAGE_KEY }),
    onChange: (state) => {
      if (quiet) return;
      const { completed, total } = state.progress;
      logEvent('onChange', `${String(completed)} of ${String(total)} complete`);
    },
  });
  // A second consumer of the same state: the "Setup n/5" pill in the app bar.
  checklist.subscribe(showProgress);

  quiet = true;
  if (carryOver) {
    // Keep what is on screen when the widget is re-created.
    checklist.reset();
    for (const id of carryOver) checklist.complete(id);
  }
  showProgress(checklist.getState());
  quiet = false;
  destroyButton.innerHTML = '<code>destroy()</code>';
}

const completedIds = () =>
  checklist
    .getState()
    .steps.filter((step) => step.completed)
    .map((step) => step.id);

function completeAndLog(id) {
  const changed = checklist.complete(id);
  logEvent('api', `complete('${id}') → ${String(changed)}`);
}

// --- Playground controls -----------------------------------------------------

const persistToggle = $('#ctl-persist');

$('#ctl-next').addEventListener('click', () => {
  const next = checklist.getState().steps.find((step) => !step.completed);
  if (next) completeAndLog(next.id);
  else logEvent('api', 'Every step is already complete');
});

$('#ctl-verify').addEventListener('click', () => {
  logEvent('app', 'The server reports the email as verified');
  completeAndLog('verify');
});

const resetAndLog = () => {
  logEvent('api', `reset() → ${String(checklist.reset())}`);
};
$('#ctl-reset').addEventListener('click', resetAndLog);
$('#done-reset').addEventListener('click', () => {
  resetAndLog();
  // The banner (and this button) just disappeared: keep focus in the widget.
  checklist.element.querySelector('button')?.focus();
});

let destroyed = false;
destroyButton.addEventListener('click', () => {
  if (destroyed) {
    mount(persistToggle.checked, completedIds());
    destroyed = false;
    logEvent('api', 'createChecklist() again, with the previous state');
    return;
  }
  checklist.destroy();
  destroyed = true;
  destroyButton.textContent = 'Create again';
  logEvent(
    'api',
    'destroy(): widget removed. The controller methods still work.',
  );
});

persistToggle.addEventListener('change', () => {
  const persist = persistToggle.checked;
  const carried = completedIds();
  if (!destroyed) checklist.destroy();
  destroyed = false;
  if (!persist) clearSavedProgress();
  writePref(persist);
  mount(persist, carried);
  logEvent(
    'api',
    persist
      ? `Re-created with storageKey '${STORAGE_KEY}'`
      : 'Re-created without storageKey; saved progress cleared',
  );
});

for (const radio of document.querySelectorAll('input[name="theme"]')) {
  radio.addEventListener('change', () => {
    $('#onboarding').className = radio.value;
  });
}

// --- Examples: copy buttons --------------------------------------------------

const copyStatus = $('#copy-status');

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const name = button.getAttribute('data-copy');
    const code = document.querySelector(`pre[data-example="${name}"]`);
    if (!code) return;
    button.dataset.label ??= button.textContent;
    const label = button.dataset.label;
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = 'Copied';
      copyStatus.textContent = 'Example copied to the clipboard';
    } catch {
      // Clipboard API unavailable (e.g. not a secure context): select instead.
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      button.textContent = 'Selected';
      copyStatus.textContent = 'Example selected. Press Control+C to copy.';
    }
    setTimeout(() => {
      button.textContent = label;
      copyStatus.textContent = '';
    }, 2000);
  });
}

// --- Reference: CSS custom properties, read from the loaded build ------------

const propRows = [
  ...checklistCss.matchAll(/var\((--stepr-checklist-[a-z-]+),\s*([^)]+)\)/g),
].map(([, name, fallback]) => {
  const row = document.createElement('tr');
  for (const value of [name, fallback.trim()]) {
    const cell = document.createElement('td');
    const code = document.createElement('code');
    code.textContent = value;
    cell.append(code);
    row.append(cell);
  }
  return row;
});
$('#css-props').replaceChildren(...propRows);

// --- Start -------------------------------------------------------------------

const persist = readPref();
persistToggle.checked = persist;
mount(persist);
if (persist) {
  const restored = completedIds().length;
  logEvent(
    'api',
    `Restored ${String(restored)} completed step${restored === 1 ? '' : 's'} from localStorage`,
  );
}

// Handy for poking at the API from the browser console.
Object.defineProperty(window, 'checklist', {
  configurable: true,
  get: () => checklist,
});
