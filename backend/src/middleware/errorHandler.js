export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

export function serverError(err, req, res, next) {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
}
