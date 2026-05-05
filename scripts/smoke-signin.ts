// scripts/smoke-signin.ts — verify N seed accounts can sign in end-to-end.
// Per .claude/rules/signin-test.md: GET /api/auth/csrf → POST credentials → GET protected route → signout.
// Exits 0 only if every account passed.

const BASE = process.env.SIGNIN_BASE_URL ?? 'http://localhost:3070';

type Account = { email: string; password: string; protectedRoute: string; role: 'owner' | 'staff' };

const ACCOUNTS: Account[] = [
  { email: 'taquocvinhbk10@gmail.com', password: process.env.OWNER1_PASSWORD ?? 'ngot1234', protectedRoute: '/admin', role: 'owner' },
  { email: 'hnlanh2910@gmail.com', password: process.env.OWNER2_PASSWORD ?? 'ngot1234', protectedRoute: '/admin', role: 'owner' },
  { email: 'staff@ngot.local', password: process.env.STAFF_PASSWORD ?? 'ngot1234', protectedRoute: '/staff', role: 'staff' },
];

class Jar {
  private map = new Map<string, string>();
  ingest(setCookies: string[] | string | null) {
    if (!setCookies) return;
    const arr = Array.isArray(setCookies) ? setCookies : [setCookies];
    for (const sc of arr) {
      // raw header may concatenate multiple Set-Cookie via comma; split on '; ' boundaries handled by single-cookie use here
      const first = sc.split(';')[0]!;
      const eq = first.indexOf('=');
      if (eq < 0) continue;
      const name = first.slice(0, eq).trim();
      const value = first.slice(eq + 1).trim();
      this.map.set(name, value);
    }
  }
  header(): string {
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

function setCookieList(res: Response): string[] {
  // Node fetch exposes raw set-cookies via getSetCookie() in undici (Node 20+).
  // Fallback: split on commas guarded by '=' in the next segment.
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === 'function') return anyHeaders.getSetCookie();
  const raw = res.headers.get('set-cookie');
  if (!raw) return [];
  return raw.split(/,(?=[^;]+=[^;]+)/g);
}

async function signinFlow(acct: Account): Promise<{ ok: true; ms: number } | { ok: false; step: string; detail: string }> {
  const t0 = Date.now();
  const jar = new Jar();

  // Step 1 — GET /api/auth/csrf to seed the cookie + obtain csrfToken
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.ingest(setCookieList(csrfRes));
  if (!csrfRes.ok) return { ok: false, step: 'csrf', detail: `HTTP ${csrfRes.status}` };
  const csrfBody = (await csrfRes.json().catch(() => ({}))) as { csrfToken?: string };
  const csrfToken = csrfBody.csrfToken;
  if (!csrfToken) return { ok: false, step: 'csrf', detail: 'csrfToken missing in response body' };

  // Step 2 — POST credentials
  const form = new URLSearchParams({
    email: acct.email,
    password: acct.password,
    csrfToken,
    callbackUrl: `${BASE}${acct.protectedRoute}`,
    redirect: 'false',
    json: 'true',
  });
  const postRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.header(),
    },
    body: form.toString(),
    redirect: 'manual',
  });
  jar.ingest(setCookieList(postRes));
  // NextAuth credentials returns 200 with JSON when redirect:false, or 302 redirect to callbackUrl on success.
  // Failure: redirect to /signin?error=... OR 401.
  const location = postRes.headers.get('location') ?? '';
  if (postRes.status >= 400) {
    return { ok: false, step: 'credentials', detail: `HTTP ${postRes.status} location=${location}` };
  }
  if (location.includes('/signin') || location.includes('error=')) {
    return { ok: false, step: 'credentials', detail: `redirected to error: ${location}` };
  }

  // Step 3 — GET protected route, expect 200 (NOT 307)
  const protRes = await fetch(`${BASE}${acct.protectedRoute}`, {
    headers: { Cookie: jar.header() },
    redirect: 'manual',
  });
  if (protRes.status === 307 || protRes.status === 302) {
    return { ok: false, step: 'protected_route', detail: `redirected ${protRes.status} location=${protRes.headers.get('location')}` };
  }
  if (!protRes.ok) {
    return { ok: false, step: 'protected_route', detail: `HTTP ${protRes.status}` };
  }
  jar.ingest(setCookieList(protRes));

  // Step 4 — POST signout
  const signoutCsrf = await fetch(`${BASE}/api/auth/csrf`, { headers: { Cookie: jar.header() } });
  jar.ingest(setCookieList(signoutCsrf));
  const signoutBody = (await signoutCsrf.json().catch(() => ({}))) as { csrfToken?: string };
  if (signoutBody.csrfToken) {
    await fetch(`${BASE}/api/auth/signout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: jar.header(),
      },
      body: new URLSearchParams({ csrfToken: signoutBody.csrfToken, callbackUrl: BASE, json: 'true' }).toString(),
      redirect: 'manual',
    });
  }

  return { ok: true, ms: Date.now() - t0 };
}

async function main() {
  console.log(`signin-smoke: ${ACCOUNTS.length} accounts against ${BASE}`);
  let pass = 0;
  let totalMs = 0;
  for (const acct of ACCOUNTS) {
    process.stdout.write(`  ${acct.email} (${acct.role}) … `);
    const r = await signinFlow(acct);
    if (r.ok) {
      console.log(`OK (${r.ms}ms)`);
      pass++;
      totalMs += r.ms;
    } else {
      console.log(`FAIL @ ${r.step} — ${r.detail}`);
    }
  }
  const avg = pass ? Math.round(totalMs / pass) : 0;
  console.log(`signin-smoke: ${pass}/${ACCOUNTS.length} accounts signed in cleanly (avg ${avg}ms).`);
  process.exit(pass === ACCOUNTS.length ? 0 : 1);
}

main().catch((e) => {
  console.error('signin-smoke: unexpected error', e);
  process.exit(1);
});
