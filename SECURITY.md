# Security

## Supported versions

The latest minor release gets fixes. Older minors do not, unless the issue is
severe and cheap to patch.

## Reporting

Open a [_private security advisory_](https://github.com/nashiuso/rewap/security/advisories/new)
rather than a public issue, or email the address on my GitHub profile.

Expect an acknowledgement within a few days. This is a side project, so a fix may
take a week or two; you will get an honest estimate rather than a promise.

## What is in scope

- Anything in the published package that could leak data the user did not intend
  to send, or execute code on behalf of someone else.
- Persistence writing to a key it should not, or reading one it should not.
- Provider code sending a request the application did not configure.

Worth stating plainly, because it is a design decision rather than a bug:

- **The library makes no network requests on its own.** Weather, IP location and
  email verification exist only as providers the application creates with an
  endpoint it chose. If a page using rewap talks to a third party, the page's own
  code did it.
- **No telemetry, no remote assets, no CDN.** Fonts and icons are local or inline.
- **Persistence is local only.** `localStorage`, `sessionStorage` or a storage
  object you pass in. There is no sync service.
- **Browser data is read, never inferred.** `useBattery` and `useNetworkInfo`
  report what the browser exposes and say so when it exposes nothing.

## What is not in scope

Cross-site scripting in an application's own markup, or a third-party provider
endpoint logging the coordinates you sent it. Both are outside the package.
