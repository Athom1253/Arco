function parseDateQueryValue(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : new Date(Number.NaN);
}

export function normalizeDateQuery(
  query: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return { ...query, [key]: parseDateQueryValue(query[key]) };
}

export function normalizeDateRangeQuery(
  query: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...query,
    from: parseDateQueryValue(query.from),
    to: parseDateQueryValue(query.to),
  };
}

export function normalizeBooleanQuery(
  query: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = query[key];
  if (value === "true") {
    return { ...query, [key]: true };
  }
  if (value === "false") {
    return { ...query, [key]: false };
  }
  return query;
}
