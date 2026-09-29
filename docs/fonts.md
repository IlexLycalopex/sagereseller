# Webfonts (dependency D4)

Pangea and Avenir Next are licensed fonts. Once the licence covers sagereseller.com, add:

- `Pangea-Regular.woff2`, `Pangea-Medium.woff2`, `Pangea-SemiBold.woff2`
- `AvenirNext-Regular.woff2`, `AvenirNext-Medium.woff2`, `AvenirNext-DemiBold.woff2`
- `fonts.css` (rename `fonts.css.example`)

`Base.astro` detects `fonts.css` at build time and only then links it and preloads
`Pangea-SemiBold.woff2` and `AvenirNext-Regular.woff2`. Until then the system
font stack is used and no font requests are made.
