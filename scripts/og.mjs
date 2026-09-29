// Generates the default Open Graph image (title on navy with wordmark).
// Run with: node scripts/og.mjs
import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#001A22"/>
  <rect width="1200" height="8" fill="#00B6ED"/>
  <text x="80" y="120" font-family="Avenir Next, DejaVu Sans, sans-serif" font-size="30" font-weight="600" fill="#8FA1A8" letter-spacing="4">THE SAGE BUYER'S GUIDE</text>
  <text x="80" y="290" font-family="Avenir Next, DejaVu Sans, sans-serif" font-size="62" font-weight="600" fill="#FFFFFF">Find the right Sage system</text>
  <text x="80" y="370" font-family="Avenir Next, DejaVu Sans, sans-serif" font-size="62" font-weight="600" fill="#FFFFFF">for your finance team</text>
  <text x="80" y="540" font-family="Avenir Next, DejaVu Sans, sans-serif" font-size="28" fill="#B8C3C8">Published by Jamie Watts and Mysoft, a UK Sage Partner</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/images/og-default.png');
console.log('Wrote public/images/og-default.png');
