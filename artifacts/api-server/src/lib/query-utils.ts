export function normalizeDateRangeQuery(
  query: Record<string, unknown>,
): Record<string, unknown> {
  const parseDate = (value: unknown) => {
    if (typeof value !== "string") {
      return value;
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
      ? date
      : new Date(Number.NaN);
  };

  return {
    ...query,
    from: parseDate(query.from),
    to: parseDate(query.to),
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
