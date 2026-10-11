// Error text is transient; export no request bodies, query strings or credentials.
export function safeSeedError(error, secrets = []) {
  const clean = value => {
    let text = String(value ?? '').slice(0, 8000);
    for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) text = text.split(secret).join('[REDACTED]');
    return text.replace(/(?:https?|postgres(?:ql)?):\/\/[^\s)]+/gi, '[URL]')
      .replace(/(?:authorization|apikey|password|access_token|refresh_token)\s*[:=]\s*[^\s,}]+/gi, '[CREDENTIAL]')
      .replace(/Bearer\s+[^\s]+|eyJ[\w.-]+/gi, '[TOKEN]')
      .replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]')
      .replace(/\{[^\n]*\}/g, '[OBJECT]')
      .replace(/["'`][^"'`\n]*["'`]/g, '[LITERAL]').slice(0, 2000);
  };
  const name = /^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(error?.name ?? '') ? error.name : 'UnknownError';
  const message = clean(error?.message);
  return { type: name, code: typeof error?.code === 'number' ? error.code : /^[A-Z0-9_]{1,80}$/.test(error?.code ?? '') ? error.code : null,
    message, stack: clean(error?.stack).split('\n').slice(0, 12),
    category: /QuotaExceeded/.test(name + message) ? 'INDEXEDDB_QUOTA' : /TransactionInactive|AbortError|ConstraintError|InvalidStateError|DatabaseClosed|Dexie|IndexedDB/i.test(name + message) ? 'INDEXEDDB_OR_TRANSACTION' : /Target.*closed|page.*closed|browser.*closed|context.*closed/i.test(message) ? 'BROWSER_LIFECYCLE' : /fetch|network|import/i.test(message) ? 'TRANSPORT_OR_MODULE_IMPORT' : 'UNCLASSIFIED' };
}
