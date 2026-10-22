const search = document.querySelector('input[type="search"]')
const rows = [...document.querySelectorAll('[data-contact-row]')]
const emptyState = document.querySelector('.no-results')

search?.addEventListener('input', () => {
  const query = search.value.trim().toLocaleLowerCase()
  for (const row of rows) {
    row.hidden = !row.dataset.search.toLocaleLowerCase().includes(query)
  }
  emptyState.hidden = rows.some((row) => !row.hidden)
})

for (const row of rows) {
  row.addEventListener('click', () => {
    for (const otherRow of rows) {
      otherRow.setAttribute('aria-pressed', String(otherRow === row))
    }
    window.parent.postMessage(
      {
        protocol: 'opaque-ui',
        version: 1,
        type: 'select',
        channel: document.body.dataset.channel,
        handle: row.dataset.handle,
      },
      document.body.dataset.parentOrigin,
    )
  })
}

const commandFields = [
  'protocol',
  'version',
  'type',
  'channel',
  'request_id',
  'action',
]

window.addEventListener('message', (event) => {
  if (
    event.source !== window.parent ||
    event.origin !== document.body.dataset.parentOrigin
  )
    return

  const command = event.data
  if (
    !command ||
    typeof command !== 'object' ||
    Array.isArray(command) ||
    Reflect.ownKeys(command).length !== commandFields.length ||
    !commandFields.every((field) => Object.hasOwn(command, field)) ||
    command.protocol !== 'opaque-ui' ||
    command.version !== 1 ||
    command.type !== 'command' ||
    command.channel !== document.body.dataset.channel ||
    typeof command.request_id !== 'string' ||
    !/^[a-zA-Z0-9_:-]{1,128}$/.test(command.request_id) ||
    (command.action !== 'focus-search' && command.action !== 'clear-selection')
  )
    return

  if (command.action === 'focus-search') {
    if (!search) return
    search.focus()
  } else {
    for (const row of rows) row.setAttribute('aria-pressed', 'false')
  }

  window.parent.postMessage(
    {
      protocol: 'opaque-ui',
      version: 1,
      type: 'action-result',
      channel: document.body.dataset.channel,
      request_id: command.request_id,
      action: command.action,
    },
    document.body.dataset.parentOrigin,
  )
})
