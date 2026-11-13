export async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`조회 실패 (HTTP ${res.status})`);
  return res.json();
}

export async function send(method, url, body) {
  const res = await fetch(url, {
    method, headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = data.message;
    throw new Error(Array.isArray(m) ? m.join('\n') : (m || `요청 실패 (HTTP ${res.status})`));
  }
  return data;
}
