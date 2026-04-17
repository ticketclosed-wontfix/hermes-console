import { test, expect } from '@playwright/test'

// These tests run against the real production build served by the systemd
// hermes-workspace unit (http://127.0.0.1:3001) and the real Hermes gateway.
// They cover the two regressions fixed in this branch:
//   1. Gateway auth forwarding — sending a message must yield a streamed reply.
//   2. Lazy session creation — clicking NEW_SESSION must NOT create DB rows.

test.describe('bug-fixes: lazy session + gateway streaming', () => {
  test('NEW_SESSION button is lazy (5 clicks, 0 new sessions)', async ({
    page,
    request,
  }) => {
    // Count existing workspace sessions via the API before clicking.
    const beforeRes = await request.get('/api/sessions?limit=200')
    expect(beforeRes.ok()).toBeTruthy()
    const before = await beforeRes.json()
    const beforeWorkspaceCount = (before.items as any[]).filter(
      (s) => s.source === 'workspace',
    ).length

    await page.goto('/')
    const newBtn = page.getByRole('button', { name: /NEW_SESSION/ })
    await expect(newBtn).toBeVisible()

    for (let i = 0; i < 5; i++) {
      await newBtn.click()
      // Small beat to let any async kicks fire.
      await page.waitForTimeout(120)
    }

    // Header should show the empty-session label.
    await expect(page.getByRole('heading', { name: 'New Session' })).toBeVisible()

    const afterRes = await request.get('/api/sessions?limit=200')
    const after = await afterRes.json()
    const afterWorkspaceCount = (after.items as any[]).filter(
      (s) => s.source === 'workspace',
    ).length

    expect(afterWorkspaceCount).toBe(beforeWorkspaceCount)
  })

  test('sending a message lazily creates a session AND streams a real response', async ({
    page,
    request,
  }) => {
    const beforeRes = await request.get('/api/sessions?limit=200')
    const before = await beforeRes.json()
    const beforeWorkspaceCount = (before.items as any[]).filter(
      (s) => s.source === 'workspace',
    ).length

    await page.goto('/')
    await page.getByRole('button', { name: /NEW_SESSION/ }).click()
    await expect(page.getByRole('heading', { name: 'New Session' })).toBeVisible()

    const textarea = page.locator('textarea')
    await textarea.click()
    await textarea.fill('Say the single word "pong" and nothing else.')

    await page.getByRole('button', { name: 'Send message' }).click()

    // An "Assistant" block should appear.
    const assistantBlock = page.locator('text=Assistant').first()
    await expect(assistantBlock).toBeVisible({ timeout: 60_000 })

    // Wait until the assistant message has non-empty content (streaming done).
    await expect
      .poll(
        async () => {
          const text = await page
            .locator('main')
            .innerText()
            .catch(() => '')
          // Strip the user echo to avoid false positives.
          const afterAssistant = text.split(/Assistant/).slice(-1)[0] || ''
          return afterAssistant.trim().length
        },
        { timeout: 60_000, intervals: [500] },
      )
      .toBeGreaterThan(2)

    // Assert a new workspace session row now exists.
    const afterRes = await request.get('/api/sessions?limit=200')
    const after = await afterRes.json()
    const afterWorkspaceCount = (after.items as any[]).filter(
      (s) => s.source === 'workspace',
    ).length
    expect(afterWorkspaceCount).toBe(beforeWorkspaceCount + 1)
  })

  test('attachment chip appears after selecting an image file', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /NEW_SESSION/ }).click()

    // Tiny 1x1 PNG payload.
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082',
      'hex',
    )

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'probe.png',
      mimeType: 'image/png',
      buffer: png,
    })

    // Chip shows the name and a remove button.
    await expect(page.getByText('probe.png')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove probe.png' })).toBeVisible()
  })

  test('tool output pretty-renders (has real newlines, not a single line blob)', async ({
    page,
    request,
  }) => {
    const res = await request.get('/api/sessions?limit=200')
    const body = await res.json()
    // Find a session with at least one tool call.
    const withTools = (body.items as any[]).find(
      (s) => (s.tool_call_count || 0) > 0,
    )
    test.skip(!withTools, 'No tool-bearing session in DB; skipping.')

    await page.goto('/')
    // Click the session in the sidebar by title/text.
    const title =
      withTools.title || `${withTools.source || 'chat'} session`
    await page.getByText(title, { exact: false }).first().click()

    // Wait for the tool blocks to render.
    await page.waitForTimeout(500)

    // Pretty-printing means the tool result block's text has real newlines
    // (multi-line structure). Pre-fix: it was one giant line with literal
    // \n escape chars inside.
    //
    // Strategy: grab the DOM of tool-call blocks and assert at least one
    // has a visible multi-line JSON body. We look at the pre/div elements
    // inside ToolCallBlock (class includes whitespace-pre-wrap + overflow).
    const toolBlockLineCounts: number[] = await page.evaluate(() => {
      // ToolCallBlock renders result/args in a div with classes matching
      // these fragments. We match on a combination of font-label +
      // whitespace-pre-wrap since those are the pretty-result containers.
      const blocks = Array.from(
        document.querySelectorAll<HTMLElement>(
          'div.whitespace-pre-wrap',
        ),
      )
      return blocks.map((b) => (b.textContent || '').split('\n').length)
    })

    expect(
      toolBlockLineCounts.length,
      'no tool-call blocks found on screen',
    ).toBeGreaterThan(0)
    // At least one tool-call pretty-printed body must have many lines
    // (pretty-printed JSON of a tool result always yields 5+ lines).
    const maxLines = Math.max(...toolBlockLineCounts, 0)
    expect(maxLines).toBeGreaterThan(5)
  })
})
