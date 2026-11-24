export const contactTopics = {
  general: 'General inquiry',
  correction: 'Error correction',
  removal: 'Profile removal request'
} as const;
export type ContactTopic = keyof typeof contactTopics;
export type ContactFields = { name: string; email: string; topic: string; profileUrl: string; message: string };
export function readContactFields(form: FormData): ContactFields {
  const read = (key: string) => { const value = form.get(key); return typeof value === 'string' ? value.trim() : ''; };
  return { name: read('name'), email: read('email'), topic: read('topic'), profileUrl: read('profileUrl'), message: read('message') };
}
export function validateContact(fields: ContactFields): keyof ContactFields | null {
  if (fields.name.length > 120) return 'name';
  if (!fields.email || fields.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return 'email';
  if (!Object.hasOwn(contactTopics, fields.topic)) return 'topic';
  if (fields.profileUrl.length > 500 || (fields.topic === 'removal' && !fields.profileUrl)) return 'profileUrl';
  if (fields.profileUrl) {
    try {
      const url = new URL(fields.profileUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'pokira.pages.dev' || url.username || url.password || url.port || !/^\/(?:en\/)?(?!en\/?$)[a-z0-9-]+\/?$/.test(url.pathname)) return 'profileUrl';
    } catch { return 'profileUrl'; }
  }
  if (!fields.message || fields.message.length > 5000) return 'message';
  return null;
}
