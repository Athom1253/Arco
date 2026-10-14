---
name: Date query normalization
description: Prevent generated OpenAPI/Zod date query parameters from rejecting browser request strings.
---

Generated API Zod schemas can represent OpenAPI date query parameters as `z.date()`, while Express receives URL query values as strings. Normalize scalar ISO dates to UTC `Date` values before validating them with the generated schema.

**Why:** Date-filtered requests returned 400 despite using valid ISO dates because client-generated query strings did not match the server schema's runtime type.

**How to apply:** On new date-filtered GET routes, reuse `normalizeDateRangeQuery` before `safeParse` and test the endpoint using actual URL query strings.
