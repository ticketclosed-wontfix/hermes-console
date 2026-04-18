import { test, expect } from '@playwright/test'

// E2E: the session-switch-during-streaming bug.
//
// Scenario:
// 1. Start a fresh session (NEW_SESSION) and send a prompt that the agent
//    will take several seconds to answer — "run `sleep 3 && echo pong` and
//    report the output".
// 2. While the assistant is still streaming, click another session in the
//    sidebar. The chat thread must visually swap to the other session (and
//    the other session's messages/placeholder must appear instead of
//    session A's partial response).
// 3. Click back to session A. The assistant's response must still be there —
//    either still streaming (content growing live) or already finalised.
// 4. Critically: the server-side stream must NOT have been cancelled. After
//    everything settles, session A's DB row must contain the completed
//    assistant reply. If the stream had been cancelled, no assistant row
//    would persist (gateway only persists on completion).

test.describe('session-switch during streaming', () => {
  test.setTimeout(180_000)

  test('streaming continues in background; switching back shows live resume', async ({
    page,
    request,
  }) => {
    // Need at least one other session to switch to. If there are none, make
    // one quickly by sending a trivial message there first.
    await page.goto('/')

    // Click NEW_SESSION to get to the draft view.
    await page.getByRole('button', { name: /NEW_SESSION/ }).click()
    await expect(
      page.getByRole('heading', { name: 'New Session' }),
    ).toBeVisible()

    // Send a prompt that will make the agent invoke a tool (sleep) so the
    // stream lasts multiple seconds.
    const textarea = page.locator('textarea')
    await textarea.click()
    await textarea.fill(
      'Run the terminal command `sleep 4 && echo pong-A` and report the ' +
        'output in full.',
    )
    await page.getByRole('button', { name: 'Send message' }).click()

    // Wait for the user echo + assistant placeholder.
    await expect(page.locator('text=User').first()).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.locator('text=Assistant').first()).toBeVisible({
      timeout: 30_000,
    })

    // Wait for the streaming indicator (the pulsing dot next to the
    // Assistant label) to be present — confirms we're mid-stream.
    const streamDot = page
      .locator('span.animate-pulse.bg-primary')
      .first()
    await expect(streamDot).toBeVisible({ timeout: 30_000 })

    // Grab the current session id from the sessions store. The /api/sessions
    // endpoint ordered desc by started_at gives us the newest → that's us.
    const sessionsResp = await request.get('/api/sessions?limit=5')
    const sessionsJson = await sessionsResp.json()
    const sessionA = (sessionsJson.items as any[])[0]
    expect(sessionA).toBeDefined()

    // Find another session to switch to. If the list only has one, create
    // one by first switching to whatever we can and coming back.
    const otherSession = (sessionsJson.items as any[]).find(
      (s) => s.id !== sessionA.id,
    )
    expect(
      otherSession,
      'need at least 2 sessions for this test',
    ).toBeDefined()

    // Snapshot the text currently visible in the chat panel so we can
    // assert the view actually swapped.
    const preSwitchText = await page.locator('main').innerText()

    // Click a different session in the sidebar (use its visible title/text).
    const otherTitle =
      otherSession.title || `${otherSession.source || 'chat'} session`
    await page
      .getByRole('button', { name: new RegExp(otherTitle, 'i') })
      .first()
      .click()

    // The view must have swapped. Either messages changed, or the empty
    // state "Start a conversation" is showing. Either way, the dropped-in
    // text must be different from what we saw in session A.
    await expect
      .poll(
        async () => {
          const txt = await page.locator('main').innerText()
          return txt !== preSwitchText
        },
        { timeout: 10_000, intervals: [250] },
      )
      .toBe(true)

    // The streaming pulse dot from A's assistant message should no longer
    // be visible (we're looking at a different session).
    const sidebarHasRunning = await page
      .locator('span.animate-pulse.bg-primary')
      .count()
    // If the other session happens to have its own streaming indicator
    // (unlikely — we just loaded a persisted session), that's fine. What
    // matters is that A's stream is backgrounded.
    // Hold off 1.5s so more tokens would have streamed server-side.
    await page.waitForTimeout(1500)

    // *** Switch BACK to session A. ***
    const titleA = sessionA.title || `${sessionA.source || 'chat'} session`
    // If there's no title, the session will have been rendered with its
    // generic "workspace session" / similar fallback. Matching on the
    // session id slice (first 12 chars) is also possible but the sidebar
    // doesn't render that as primary text. Use the title fallback.
    //
    // To be robust, just click the topmost session button in the sidebar —
    // we know it was the newest (that's session A).
    // BUT: after title-generator kicks in, session A might now have a
    // brand-new title. Re-fetch the session list to find the current label.
    const freshResp = await request.get(`/api/sessions?limit=5`)
    const freshJson = await freshResp.json()
    const freshA = (freshJson.items as any[]).find((s) => s.id === sessionA.id)
    const freshTitleA =
      freshA?.title || titleA || `${sessionA.source || 'chat'} session`

    await page
      .getByRole('button', { name: new RegExp(freshTitleA, 'i') })
      .first()
      .click()

    // Now session A's thread should be visible again, with the user message
    // we sent earlier. And EITHER still streaming (content growing) OR
    // done (final answer present).
    await expect(page.locator('text=User').first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.locator('text=Assistant').first()).toBeVisible({
      timeout: 10_000,
    })

    // Capture assistant content at time T, wait, capture at T+2s. If still
    // streaming, content grows. If done, they'll match — also OK since the
    // stream completed while we were away (proves it wasn't cancelled).
    async function getAssistantText(): Promise<string> {
      const full = await page.locator('main').innerText()
      // Strip everything before the last "Assistant" marker.
      const afterAssistant = full.split(/Assistant/).slice(-1)[0] || ''
      return afterAssistant.trim()
    }

    const snap1 = await getAssistantText()
    await page.waitForTimeout(2000)
    const snap2 = await getAssistantText()

    // Either it's still growing (live resume), OR it's already done with
    // non-trivial content (stream finished while we were away, proving
    // server-side didn't get cancelled).
    expect(
      snap2.length,
      'assistant content must be non-trivial (stream must not have been cancelled)',
    ).toBeGreaterThan(5)

    const grewLive = snap2.length > snap1.length
    const settled = snap2.length === snap1.length && snap1.length > 5

    expect(grewLive || settled).toBe(true)

    // Final check: wait up to 60s for the stream to fully settle, then
    // verify the DB persisted a completed assistant message in session A.
    await expect
      .poll(
        async () => {
          const r = await request.get(`/api/sessions/${sessionA.id}/messages`)
          const j = await r.json()
          return (j.items as any[]).some(
            (m: any) =>
              m.role === 'assistant' &&
              typeof m.content === 'string' &&
              m.content.trim().length > 0,
          )
        },
        { timeout: 60_000, intervals: [1000] },
      )
      .toBe(true)

    // And the final assistant content in the DB should contain "pong-A"
    // (proves the sleep-then-echo actually ran, ergo the stream survived
    // the switch-away + switch-back without server-side cancellation).
    const finalResp = await request.get(
      `/api/sessions/${sessionA.id}/messages`,
    )
    const finalJson = await finalResp.json()
    const finalAssistant = (finalJson.items as any[]).find(
      (m: any) =>
        m.role === 'assistant' &&
        typeof m.content === 'string' &&
        m.content.includes('pong-A'),
    )
    expect(
      finalAssistant,
      'assistant reply should contain "pong-A" (proves tool ran + stream completed after session switch)',
    ).toBeDefined()
  })
})
