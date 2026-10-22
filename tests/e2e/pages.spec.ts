import { expect, test, type Page } from '@playwright/test'

const pageErrors = new WeakMap<Page, string[]>()

function componentFrame(page: Page, component = 'contact') {
  return page.frameLocator(`iframe[data-private-component="${component}"]`)
}

async function expectHostContainsNoContactData(page: Page) {
  const content = await page.evaluate(() =>
    JSON.stringify({
      text: document.body.innerText,
      attributes: Array.from(document.querySelectorAll('*'), (element) =>
        Array.from(element.attributes, (attribute) => attribute.value),
      ).flat(),
    }),
  )
  for (const value of ['Maya Chen', '@mayac', 'Alex Morgan', 'Noah Williams']) {
    expect(content).not.toContain(value)
  }
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./')
})

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([])
})

test('Pages renders public fixtures in a same-site sandbox whose document the host cannot read', async ({
  page,
}, testInfo) => {
  const iframe = page.locator('iframe[data-private-component="contact"]')
  const frame = componentFrame(page)
  await expect(frame.getByText('Maya Chen', { exact: true })).toBeVisible()
  const source = new URL((await iframe.getAttribute('src'))!, page.url())
  expect(source.pathname).toBe('/iframe-playground/provider/index.html')
  expect(source.origin).toBe(new URL(page.url()).origin)
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts')
  await expect
    .poll(() =>
      frame
        .locator('img')
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true)
  const access = await iframe.evaluate((element) => {
    const frame = element as HTMLIFrameElement
    let errorName: string | null = null
    try {
      void frame.contentWindow!.document.body.innerText
    } catch (error) {
      errorName = (error as DOMException).name
    }
    return { documentIsNull: frame.contentDocument === null, errorName }
  })
  expect(access).toEqual({ documentIsNull: true, errorName: 'SecurityError' })
  await expectHostContainsNoContactData(page)
  await expect(
    page.getByText('Fictional data is public', { exact: false }),
  ).toBeVisible()
  const hostText = await page.locator('body').innerText()
  expect(hostText).not.toContain('localhost:5184')
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(page.url()).hostname)
  )
    expect(hostText).not.toContain('localhost')
  const sourceExample = page.getByRole('region', {
    name: 'Integration example',
    exact: true,
  })
  await expect(sourceExample).toContainText(source.origin)
  await expect(sourceExample).toContainText(
    '/iframe-playground/provider/index.html',
  )
  const publicFixture = await page.evaluate(async (url) => {
    const response = await fetch(url)
    return {
      status: response.status,
      containsFictionalContact: (await response.text()).includes('Maya Chen'),
    }
  }, new URL('embed.js', source).href)
  expect(publicFixture).toEqual({ status: 200, containsFictionalContact: true })
  await page.screenshot({
    path: testInfo.outputPath('pages-playground.png'),
    fullPage: true,
  })
})

test('Pages presentation props and contact handles resolve inside the static iframe', async ({
  page,
}) => {
  const frame = componentFrame(page)
  await expect(frame.getByText('Maya Chen', { exact: true })).toBeVisible()
  await page
    .getByRole('checkbox', { name: 'Show avatar', exact: true })
    .uncheck()
  await expect(frame.locator('img')).toHaveCount(0)
  await page
    .getByRole('checkbox', { name: 'Show username', exact: true })
    .uncheck()
  await expect(frame.getByText('@mayac', { exact: true })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Show avatar', exact: true }).check()
  await page
    .getByRole('checkbox', { name: 'Show username', exact: true })
    .check()
  await page
    .getByRole('combobox', { name: 'Contact handle', exact: true })
    .selectOption('ct_9pw4')
  await expect(frame.getByText('Alex Morgan', { exact: true })).toBeVisible()
  await expect(frame.locator('img')).toHaveCount(1)
  await page
    .getByRole('combobox', { name: 'Theme', exact: true })
    .selectOption('dark')
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'dark')
  const iframe = page.locator('iframe[data-private-component="contact"]')
  const comfortableHeight = await iframe.evaluate(
    (element) => element.clientHeight,
  )
  await page
    .getByRole('combobox', { name: 'Density', exact: true })
    .selectOption('compact')
  await expect
    .poll(() => iframe.evaluate((element) => element.clientHeight))
    .toBeLessThan(comfortableHeight)
  await expect(frame.getByText('Alex Morgan', { exact: true })).toBeVisible()
  await expectHostContainsNoContactData(page)
})

test('Pages supports both message directions from the opaque sandbox without reloading the list', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Contact list', exact: true }).click()
  const frame = componentFrame(page, 'list')
  await expect(frame.getByText('Maya Chen', { exact: true })).toBeVisible()
  await page.evaluate(() => {
    const iframe = document.querySelector<HTMLIFrameElement>(
      'iframe[data-private-component="list"]',
    )!
    const target = window as Window & {
      receivedMessages?: { origin: string; data: unknown }[]
    }
    target.receivedMessages = []
    window.addEventListener('message', (event) => {
      if (event.source === iframe.contentWindow)
        target.receivedMessages!.push({
          origin: event.origin,
          data: event.data,
        })
    })
  })
  await frame.locator('body').evaluate((body) => {
    body.dataset.testDocument = 'pages-command-document'
    const target = window as Window & { receivedCommands?: unknown[] }
    target.receivedCommands = []
    window.addEventListener('message', (event) => {
      if (event.source === window.parent)
        target.receivedCommands!.push(event.data)
    })
  })
  const source = await page
    .locator('iframe[data-private-component="list"]')
    .getAttribute('src')
  const search = frame.getByRole('searchbox')
  await search.fill('Maya')
  await frame.getByRole('button', { name: /Maya Chen/ }).click()
  await expect(
    page.getByLabel('Selected contact handle', { exact: true }),
  ).toHaveText('ct_7hk2')
  const preview = page.getByRole('region', {
    name: 'Selected contact preview',
    exact: true,
  })
  await expect(
    preview.frameLocator('iframe').getByText('Maya Chen', { exact: true }),
  ).toBeVisible()
  await expect(preview.locator('iframe')).toHaveAttribute(
    'sandbox',
    'allow-scripts',
  )
  await page.getByRole('button', { name: 'Focus search', exact: true }).click()
  await expect(search).toBeFocused()
  await page
    .getByRole('button', { name: 'Clear selection', exact: true })
    .click()
  await expect(
    frame.getByRole('button', { name: /Maya Chen/ }),
  ).toHaveAttribute('aria-pressed', 'false')
  await expect(
    page.getByLabel('Selected contact handle', { exact: true }),
  ).toHaveText('No contact selected')
  await expect(preview.locator('iframe')).toHaveCount(0)
  await expect(search).toHaveValue('Maya')
  await expect(frame.locator('body')).toHaveAttribute(
    'data-test-document',
    'pages-command-document',
  )
  await expect(
    page.locator('iframe[data-private-component="list"]'),
  ).toHaveAttribute('src', source!)
  const commands = await frame
    .locator('body')
    .evaluate(
      () =>
        (window as Window & { receivedCommands?: Record<string, unknown>[] })
          .receivedCommands!,
    )
  const channel = new URL(source!, page.url()).searchParams.get('channel')
  expect(commands).toEqual(
    ['focus-search', 'clear-selection'].map((action) => ({
      protocol: 'opaque-ui',
      version: 1,
      type: 'command',
      channel,
      request_id: expect.any(String),
      action,
    })),
  )
  const selection = {
    protocol: 'opaque-ui',
    version: 1,
    type: 'select',
    channel,
    handle: 'ct_7hk2',
  }
  const results = commands.map((command) => ({
    ...command,
    type: 'action-result',
  }))
  expect(
    await page.evaluate(
      () =>
        (window as Window & { receivedMessages?: unknown[] }).receivedMessages,
    ),
  ).toEqual([selection, ...results].map((data) => ({ origin: 'null', data })))
  const log = page.getByRole('region', { name: 'Event log', exact: true })
  await expect(log.locator('pre')).toHaveCount(5)
  expect(
    (await log.locator('pre').allTextContents()).map((message) =>
      JSON.parse(message),
    ),
  ).toEqual([selection, commands[0], results[0], commands[1], results[1]])
  await expect(log.getByText('Host → iframe', { exact: true })).toHaveCount(2)
  await expect(log.getByText('Iframe → host', { exact: true })).toHaveCount(3)
  await expectHostContainsNoContactData(page)
})

test('a visible Pages list accepts its first interaction without a follow-up script request', async ({
  page,
}) => {
  await page.route('**/provider/component.js', (route) => route.abort())
  await page.getByRole('button', { name: 'Contact list', exact: true }).click()
  const frame = componentFrame(page, 'list')
  await frame.getByRole('button', { name: /Maya Chen/ }).click()
  await expect(
    page.getByLabel('Selected contact handle', { exact: true }),
  ).toHaveText('ct_7hk2')
  await page.getByRole('button', { name: 'Focus search', exact: true }).click()
  await expect(frame.getByRole('searchbox')).toBeFocused()
  await expect(
    page.getByRole('region', { name: 'Event log', exact: true }).locator('pre'),
  ).toHaveCount(3)
})

test('Pages rejects null-origin selection messages from a different window', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Contact list', exact: true }).click()
  const frame = componentFrame(page, 'list')
  await expect(frame.getByText('Maya Chen', { exact: true })).toBeVisible()
  const log = page.getByRole('region', { name: 'Event log', exact: true })
  const initialLog = await log.innerText()
  const attackerOrigin = await page.evaluate(() => {
    const iframe = document.querySelector<HTMLIFrameElement>(
      'iframe[data-private-component="list"]',
    )!
    const payload = {
      protocol: 'opaque-ui',
      version: 1,
      type: 'select',
      channel: new URL(iframe.src).searchParams.get('channel'),
      handle: 'ct_9pw4',
    }
    const attacker = document.createElement('iframe')
    attacker.sandbox.add('allow-scripts')
    attacker.hidden = true
    return new Promise<string>((resolve) => {
      const receive = (event: MessageEvent) => {
        if (event.source !== attacker.contentWindow) return
        window.removeEventListener('message', receive)
        attacker.remove()
        resolve(event.origin)
      }
      window.addEventListener('message', receive)
      attacker.srcdoc = `<script>window.parent.postMessage(${JSON.stringify(payload)}, '*')</script>`
      document.body.append(attacker)
    })
  })
  expect(attackerOrigin).toBe('null')
  await expect(log).toHaveText(initialLog, { useInnerText: true })
  await expect(
    page.getByLabel('Selected contact handle', { exact: true }),
  ).toHaveText('No contact selected')
  await frame.getByRole('button', { name: /Maya Chen/ }).click()
  await expect(
    page.getByLabel('Selected contact handle', { exact: true }),
  ).toHaveText('ct_7hk2')
  await expect(log.locator('pre')).toHaveCount(1)
})

test('the populated Pages list and message log fit a narrow viewport', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Contact list', exact: true }).click()
  await componentFrame(page, 'list')
    .getByRole('button', { name: /Maya Chen/ })
    .click()
  await page.getByRole('button', { name: 'Focus search', exact: true }).click()
  const log = page.getByRole('region', { name: 'Event log', exact: true })
  await expect(log.locator('pre')).toHaveCount(3)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
  for (const payload of await log.locator('pre').all()) {
    expect(
      await payload.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true)
  }
  await log.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: testInfo.outputPath('pages-mobile-messages.png'),
  })
})
