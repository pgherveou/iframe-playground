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
