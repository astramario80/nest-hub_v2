(() => {
  const destination = new URL('/api/signals?asset=index', location.origin);
  const query = new URLSearchParams(location.search);
  for (const key of ['code', 'state', 'error']) {
    if (query.has(key)) destination.searchParams.set(key, query.get(key));
  }
  location.replace(destination.href);
})();
