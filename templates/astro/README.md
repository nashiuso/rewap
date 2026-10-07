# **NAME**

An Astro project with [`@nashiuso/rewap`](https://github.com/nashisuso/rewap).

```bash
npm run dev
```

There is no Rewap-specific Astro integration, and there does not need to be: the
React bindings render on the server and hydrate in the browser, so `@astrojs/react`
is the whole story.

- `src/pages/index.astro` loads the dashboard with `client:visible`, and a second
  copy with `client:load` to show the difference.
- `src/components/Dashboard.tsx` is an ordinary React component.
