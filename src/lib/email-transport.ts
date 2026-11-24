// Web3Forms access keys are public form identifiers, not account credentials.
// Its free plan requires this request to originate in the visitor's browser.
export function prepareEmailFields(fields: FormData, accessKey: string, subject: string, pageUrl: string): FormData {
  if (!accessKey) throw new Error('Email delivery is not configured');
  const prepared = new FormData();
  for (const [key, value] of fields) {
    if (key !== 'website') prepared.set(key, value);
  }
  prepared.set('access_key', accessKey);
  prepared.set('subject', subject.replace(/[\r\n]/g, ' '));
  prepared.set('from_name', 'Pokira');
  prepared.set('page_url', pageUrl);
  // An unchecked honeypot is omitted, as in Web3Forms' documented example.
  if (fields.get('website')) prepared.set('botcheck', 'true');
  return prepared;
}
