export async function api(method, path, body) {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  })
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`)
  return data
}
