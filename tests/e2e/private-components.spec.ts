import { expect, test, type Page } from '@playwright/test'

const providerOrigin = 'http://localhost:5184'
const pageErrors = new WeakMap<Page, string[]>()
const privateNames = [
  'Maya Chen',
  'Alex Morgan',
  'Noah Williams',
  'Sofia Rivera',
  'Jamie Park',
]

function componentFrame(page: Page, component = 'contact') {
  return page.frameLocator(`iframe[data-private-component="${component}"]`)
}

async function expectHostContainsNoContactData(
  page: Page,
  privateValues: string[] = [],
) {
  const hostContent = await page.evaluate(() => ({
    text: document.body.innerText,
    attributes: Array.from(document.querySelectorAll('*'), (element) =>
      Array.from(element.attributes, (attribute) => attribute.value),
    ).flat(),
  }))
  for (const name of [...privateNames, '@mayac', ...privateValues]) {
    expect(JSON.stringify(hostContent)).not.toContain(name)
  }
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
})

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([])
})

test('renders a resolved contact inside its iframe without exposing contact data to the host', async ({
  page,
}, testInfo) => {
  const frame = componentFrame(page)
  await expect(frame.getByText('Maya Chen', { exact: true })).toBeVisible()
  await expect(frame.getByText('@mayac', { exact: true })).toBeVisible()
  await expect(frame.locator('img')).toHaveCount(1)
  await expect
    .poll(() =>
      frame
        .locator('img')
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true)
  const avatarSource = await frame.locator('img').getAttribute('src')
  expect(avatarSource).toBeTruthy()
  await expectHostContainsNoContactData(page, [avatarSource!])
  await page.screenshot({
    path: testInfo.outputPath('playground.png'),
    fullPage: true,
  })
})

test('the browser denies the host both document access and fetching private frame content', async ({
  page,
}) => {
  await expect(
    componentFrame(page).getByText('Maya Chen', { exact: true }),
  ).toBeVisible()
  const access = await page
    .locator('iframe[data-private-component="contact"]')
    .evaluate((element) => {
      const iframe = element as HTMLIFrameElement
      let readError: string | null = null
      try {
        void iframe.contentWindow!.document.body.innerText
      } catch (error) {
        readError = (error as DOMException).name
      }
      return { documentIsNull: iframe.contentDocument === null, readError }
    })
  expect(access).toEqual({ documentIsNull: true, readError: 'SecurityError' })

  const frameUrl = await page
    .locator('iframe[data-private-component="contact"]')
    .getAttribute('src')
  const fetchResult = await page.evaluate(async (url) => {
    try {
      await fetch(url!)
      return 'readable'
    } catch (error) {
      return (error as Error).name
    }
  }, frameUrl)
  expect(fetchResult).toBe('TypeError')

  await page
    .getByRole('button', { name: 'Test DOM access', exact: true })
    .click()
  await expect(page.getByText(/SecurityError/).first()).toBeVisible()
})

test('presentation props and opaque handles update the iframe content', async ({
  page,
}) => {
  const frame = componentFrame(page)
  await expect(frame.getByText('Maya Chen', { exact: true })).toBeVisible()
  await page.getByLabel('Show avatar', { exact: true }).uncheck()
  await expect(frame.locator('img')).toHaveCount(0)
  await page.getByLabel('Show username', { exact: true }).uncheck()
  await expect(frame.getByText('@mayac', { exact: true })).toHaveCount(0)
  await page.getByLabel('Show avatar', { exact: true }).check()
  await page.getByLabel('Show username', { exact: true }).check()
  await expect(frame.locator('img')).toHaveCount(1)
  await expect(frame.getByText('@mayac', { exact: true })).toBeVisible()

  await page
    .getByRole('combobox', { name: 'Contact handle', exact: true })
    .selectOption('ct_9pw4')
  await expect(frame.getByText('Alex Morgan', { exact: true })).toBeVisible()
  await expect(frame.getByText('Maya Chen', { exact: true })).toHaveCount(0)
  await expectHostContainsNoContactData(page)
})

test('the avatar can render inside the provider but the host cannot embed its image directly', async ({
  page,
}) => {
  const avatar = componentFrame(page).locator('img')
  await expect
    .poll(() =>
      avatar.evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
    )
    .toBe(true)
  const imageUrl = new URL((await avatar.getAttribute('src'))!, providerOrigin)
    .href
  const result = await page.evaluate(
    (url) =>
      new Promise<string>((resolve) => {
        const image = new Image()
        image.onload = () => resolve('loaded')
        image.onerror = () => resolve('blocked')
        image.src = url
        document.body.append(image)
      }),
    imageUrl,
  )
  expect(result).toBe('blocked')
})

test('avatar size changes public geometry and an unknown handle does not reveal data through geometry', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Avatar', exact: true }).click()
  const iframe = page.locator('iframe[data-private-component="avatar"]')
  await expect(componentFrame(page, 'avatar').locator('img')).toBeVisible()
  await page
    .getByRole('combobox', { name: 'Size', exact: true })
    .selectOption('small')
  const smallSize = await iframe.evaluate((element) => ({
    width: element.clientWidth,
    height: element.clientHeight,
  }))
  await page
    .getByRole('combobox', { name: 'Size', exact: true })
    .selectOption('large')
  await expect
    .poll(() => iframe.evaluate((element) => element.clientWidth))
    .toBeGreaterThan(smallSize.width)
  const knownSize = await iframe.evaluate((element) => ({
    width: element.clientWidth,
    height: element.clientHeight,
  }))
  await page
    .getByRole('combobox', { name: 'Contact handle', exact: true })
    .selectOption('ct_missing')
  await expect(
    componentFrame(page, 'avatar').getByText(/unavailable/i),
  ).toBeVisible()
  expect(
    await iframe.evaluate((element) => ({
      width: element.clientWidth,
      height: element.clientHeight,
    })),
  ).toEqual(knownSize)
  await expectHostContainsNoContactData(page)
})

test('theme and density change the frame presentation without revealing contact data', async ({
  page,
}) => {
  const frame = componentFrame(page)
  const iframe = page.locator('iframe[data-private-component="contact"]')
  await expect(frame.getByText('Maya Chen', { exact: true })).toBeVisible()
  const lightBackground = await frame
    .locator('.contact-card')
    .evaluate((element) => getComputedStyle(element).backgroundColor)
  const comfortableHeight = await iframe.evaluate(
    (element) => element.clientHeight,
  )
  await page
    .getByRole('combobox', { name: 'Theme', exact: true })
    .selectOption('dark')
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect
    .poll(() =>
      frame
        .locator('.contact-card')
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe(lightBackground)
  await page
    .getByRole('combobox', { name: 'Density', exact: true })
    .selectOption('compact')
  await expect
    .poll(() => iframe.evaluate((element) => element.clientHeight))
    .toBeLessThan(comfortableHeight)
  await expect(frame.getByText('Maya Chen', { exact: true })).toBeVisible()
  await expectHostContainsNoContactData(page)
})

test('list search stays private and selection releases only the selected opaque handle', async ({
  page,
}) => {
  await page.evaluate((origin) => {
    const target = window as Window & { receivedProviderMessages?: unknown[] }
    target.receivedProviderMessages = []
    window.addEventListener('message', (event) => {
      if (event.origin === origin)
        target.receivedProviderMessages!.push(event.data)
    })
  }, providerOrigin)
  await page.getByRole('button', { name: 'Contact list', exact: true }).click()
  const frame = componentFrame(page, 'list')
  await expect(frame.getByText('Maya Chen', { exact: true })).toBeVisible()
  await expect(frame.getByText('Alex Morgan', { exact: true })).toBeVisible()
  await frame.getByRole('searchbox').fill('Maya')
  await expect(frame.getByText('Maya Chen', { exact: true })).toBeVisible()
  await expect(
    frame.getByText('Alex Morgan', { exact: true }),
  ).not.toBeVisible()
  await expectHostContainsNoContactData(page)

  expect(
    await page.evaluate(
      () =>
        (window as Window & { receivedProviderMessages?: unknown[] })
          .receivedProviderMessages,
    ),
  ).toEqual([])
  await frame.getByRole('button', { name: /Maya Chen/ }).click()
  await expect(
    page.getByRole('region', { name: 'Event log', exact: true }),
  ).toContainText('ct_7hk2')
  const frameUrl = new URL(
    (await page
      .locator('iframe[data-private-component="list"]')
      .getAttribute('src'))!,
  )
  expect(
    await page.evaluate(
      () =>
        (window as Window & { receivedProviderMessages?: unknown[] })
          .receivedProviderMessages,
    ),
  ).toEqual([
    {
      protocol: 'opaque-ui',
      version: 1,
      type: 'select',
      channel: frameUrl.searchParams.get('channel'),
      handle: 'ct_7hk2',
    },
  ])
  await expectHostContainsNoContactData(page)
})

test('the package rejects selection messages with the wrong source, origin, or extra data', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Contact list', exact: true }).click()
  await expect(
    componentFrame(page, 'list').getByText('Maya Chen', { exact: true }),
  ).toBeVisible()
  const eventLog = page.getByRole('region', { name: 'Event log', exact: true })
  const initialLog = await eventLog.innerText()
  await page.evaluate((origin) => {
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
    for (const message of [
      { data: payload, source: window, origin },
      {
        data: payload,
        source: iframe.contentWindow,
        origin: window.location.origin,
      },
      {
        data: { ...payload, username: '@private' },
        source: iframe.contentWindow,
        origin,
      },
      {
        data: { ...payload, channel: 'unrelated-frame' },
        source: iframe.contentWindow,
        origin,
      },
    ]) {
      window.dispatchEvent(new MessageEvent('message', message))
    }
  }, providerOrigin)
  expect(await eventLog.innerText()).toBe(initialLog)
  await componentFrame(page, 'list')
    .getByRole('button', { name: /Maya Chen/ })
    .click()
  await expect(eventLog).toContainText('ct_7hk2')
})

test('list contents and missing handles do not change the public frame dimensions', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Contact list', exact: true }).click()
  const frame = componentFrame(page, 'list')
  const iframe = page.locator('iframe[data-private-component="list"]')
  await expect(frame.getByRole('button')).toHaveCount(5)
  const initialSize = await iframe.evaluate((element) => ({
    width: element.clientWidth,
    height: element.clientHeight,
  }))
  await page
    .getByRole('combobox', { name: 'List handle', exact: true })
    .selectOption('ls_6ty2')
  await expect(frame.getByRole('button')).toHaveCount(3)
  expect(
    await iframe.evaluate((element) => ({
      width: element.clientWidth,
      height: element.clientHeight,
    })),
  ).toEqual(initialSize)
  await page
    .getByRole('combobox', { name: 'List handle', exact: true })
    .selectOption('ls_missing')
  await expect(
    frame.getByText('List unavailable', { exact: true }),
  ).toBeVisible()
  expect(
    await iframe.evaluate((element) => ({
      width: element.clientWidth,
      height: element.clientHeight,
    })),
  ).toEqual(initialSize)
  await expectHostContainsNoContactData(page)
})

test('the host server cannot serve the provider source through its filesystem routes', async ({
  request,
}) => {
  const sourcePath = `${process.cwd()}/apps/provider/src/server.tsx`
  const response = await request.get(`/@fs${sourcePath}`)
  const content = await response.text()
  expect(content).not.toContain('node:http')
  expect(content).not.toContain('Maya Chen')
  if (!process.env.TEST_PRODUCTION) expect(response.status()).toBe(403)
})

test('the host and contact iframe fit a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    componentFrame(page).getByText('Maya Chen', { exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
  const iframeBounds = await page
    .locator('iframe[data-private-component="contact"]')
    .boundingBox()
  expect(iframeBounds).not.toBeNull()
  expect(iframeBounds!.x + iframeBounds!.width).toBeLessThanOrEqual(390)
})
