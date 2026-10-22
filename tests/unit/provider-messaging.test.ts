import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const script = readFileSync('apps/provider/public/component.js', 'utf8')
const parentOrigin = 'http://localhost:5183'
const channel = ':r0:'
const command = {
  protocol: 'opaque-ui',
  version: 1,
  type: 'command',
  channel,
  request_id: 'rq_829b47b5-faa1-4f71-a535-e028f8b0d128',
  action: 'focus-search',
}

class ContactRow extends EventTarget {
  hidden = false
  dataset: { handle: string; search: string }
  attributes = new Map([['aria-pressed', 'false']])

  constructor(handle: string, name: string) {
    super()
    this.dataset = { handle, search: name }
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
}

function createComponent(available = true) {
  const messages: { data: unknown; targetOrigin: string }[] = []
  const parent = {
    postMessage(data: unknown, targetOrigin: string) {
      messages.push({ data, targetOrigin })
    },
  }
  const search = Object.assign(new EventTarget(), {
    value: '',
    focus() {
      document.activeElement = search
    },
  })
  const rows = available
    ? [
        new ContactRow('ct_first', 'First Private Name'),
        new ContactRow('ct_second', 'Second Private Name'),
      ]
    : []
  const emptyState = { hidden: true }
  const document = {
    body: { dataset: { parentOrigin, channel } },
    activeElement: null as EventTarget | null,
    querySelector(selector: string) {
      if (!available) return null
      return selector === 'input[type="search"]' ? search : emptyState
    },
    querySelectorAll() {
      return rows
    },
  }
  const window = Object.assign(new EventTarget(), { parent })
  runInNewContext(script, { document, window })

  return {
    document,
    search,
    rows,
    messages,
    emptyState,
    receive(data: unknown, sender: { origin?: string; source?: object } = {}) {
      window.dispatchEvent(
        Object.assign(new Event('message'), {
          data,
          origin: sender.origin ?? parentOrigin,
          source: sender.source ?? parent,
        }),
      )
    },
    filter(value: string) {
      search.value = value
      search.dispatchEvent(new Event('input'))
    },
  }
}

describe('provider message handling', () => {
  it('keeps initialization and search private and only sends a handle on selection', () => {
    const component = createComponent()
    component.filter('first')
    expect(component.messages).toEqual([])
    component.rows[0].dispatchEvent(new Event('click'))

    expect(component.messages).toEqual([
      {
        data: {
          protocol: 'opaque-ui',
          version: 1,
          type: 'select',
          channel,
          handle: 'ct_first',
        },
        targetOrigin: parentOrigin,
      },
    ])
  })

  it('focuses search and acknowledges the command without disclosing the query', () => {
    const component = createComponent()
    component.filter('first')
    component.receive(command)

    expect({
      focused: component.document.activeElement === component.search,
      query: component.search.value,
      hiddenRows: component.rows.map((row) => row.hidden),
      messages: component.messages,
    }).toEqual({
      focused: true,
      query: 'first',
      hiddenRows: [false, true],
      messages: [
        {
          data: { ...command, type: 'action-result' },
          targetOrigin: parentOrigin,
        },
      ],
    })
  })

  it('clears selection while preserving the private search query and results', () => {
    const component = createComponent()
    component.filter('first')
    component.rows[0].dispatchEvent(new Event('click'))
    component.messages.length = 0
    const clearCommand = { ...command, action: 'clear-selection' }
    component.receive(clearCommand)

    expect({
      selections: component.rows.map((row) =>
        row.attributes.get('aria-pressed'),
      ),
      query: component.search.value,
      hiddenRows: component.rows.map((row) => row.hidden),
      empty: component.emptyState.hidden,
      messages: component.messages,
    }).toEqual({
      selections: ['false', 'false'],
      query: 'first',
      hiddenRows: [false, true],
      empty: true,
      messages: [
        {
          data: { ...clearCommand, type: 'action-result' },
          targetOrigin: parentOrigin,
        },
      ],
    })
  })

  it.each<{ name: string; data: unknown }>([
    { name: 'null', data: null },
    { name: 'array', data: [command] },
    { name: 'string', data: JSON.stringify(command) },
    { name: 'inherited fields', data: Object.create(command) },
    { name: 'wrong protocol', data: { ...command, protocol: 'other' } },
    { name: 'wrong version', data: { ...command, version: '1' } },
    { name: 'wrong type', data: { ...command, type: 'action-result' } },
    { name: 'wrong channel', data: { ...command, channel: ':r1:' } },
    { name: 'unknown action', data: { ...command, action: 'read-search' } },
    { name: 'missing action', data: { ...command, action: undefined } },
    { name: 'extra data', data: { ...command, privateData: 'not allowed' } },
    { name: 'missing request ID', data: { ...command, request_id: undefined } },
    { name: 'numeric request ID', data: { ...command, request_id: 12 } },
    { name: 'empty request ID', data: { ...command, request_id: '' } },
    {
      name: 'unsafe request ID',
      data: { ...command, request_id: '<request>' },
    },
    {
      name: 'oversized request ID',
      data: { ...command, request_id: 'r'.repeat(129) },
    },
  ])('ignores $name commands without a reply', ({ data }) => {
    const component = createComponent()
    component.receive(data)
    expect({
      focused: component.document.activeElement,
      messages: component.messages,
    }).toEqual({ focused: null, messages: [] })
  })

  it.each([
    { origin: 'https://untrusted.example' },
    { origin: `${parentOrigin}.untrusted.example` },
    { source: {} },
  ])('ignores commands from an untrusted sender %j', (sender) => {
    const component = createComponent()
    component.receive(command, sender)
    expect({
      focused: component.document.activeElement,
      messages: component.messages,
    }).toEqual({ focused: null, messages: [] })
  })

  it('does not clear selection for an invalid command', () => {
    const component = createComponent()
    component.rows[0].dispatchEvent(new Event('click'))
    component.messages.length = 0
    component.receive({ ...command, action: 'clear-selection', extra: true })
    expect({
      selections: component.rows.map((row) =>
        row.attributes.get('aria-pressed'),
      ),
      messages: component.messages,
    }).toEqual({ selections: ['true', 'false'], messages: [] })
  })

  it('does not acknowledge focus when the list is unavailable', () => {
    const component = createComponent(false)
    component.receive(command)
    expect({
      focused: component.document.activeElement,
      messages: component.messages,
    }).toEqual({ focused: null, messages: [] })
  })
})
