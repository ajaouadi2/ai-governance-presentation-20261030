export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Opération impossible.');
  return data as T;
}
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('fr-CH', { dateStyle: 'medium', timeZone: 'Europe/Zurich' }).format(
    new Date(value),
  );
