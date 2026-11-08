---
"@jameswyse/oxc-config": minor
---

Update `eslint-plugin-react-you-might-not-need-an-effect` to 1.1.0. The `react` profile's effect rules now recognise hooks imported under another name, such as `import { useEffect as useE } from "react"`, called through a default or namespace import with any name, such as `R.useState`, or imported from `preact/hooks`, `preact/compat` or `@wordpress/element`. Previously only bare `useState`, `useRef` and `useEffect` calls and `React.<hook>` were checked. Projects with the `react` profile may see new errors.
