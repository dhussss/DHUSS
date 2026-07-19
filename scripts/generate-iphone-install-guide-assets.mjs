import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outputDirectory = path.join(process.cwd(), "public", "guides");
const width = 1200;
const height = 700;

const palette = {
  ink: "#171a1d",
  moss: "#5b655f",
  mint: "#0d7660",
  paper: "#f7f8f6",
  line: "#dfe3de",
  blue: "#087af5"
};

function shell(content) {
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="700" rx="36" fill="${palette.paper}"/>
      <rect x="250" y="42" width="700" height="616" rx="54" fill="#ffffff" stroke="${palette.line}" stroke-width="4"/>
      <rect x="510" y="62" width="180" height="20" rx="10" fill="${palette.ink}"/>
      ${content}
    </svg>`;
}

const assets = [
  {
    name: "iphone-install-share.png",
    svg: shell(`
      <text x="600" y="144" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${palette.ink}">Trade Invoice Tracker</text>
      <rect x="300" y="180" width="600" height="330" rx="24" fill="#f4f8f6"/>
      <circle cx="600" cy="330" r="78" fill="#e1f2ed"/>
      <path d="M600 374V278 M566 312L600 278L634 312" fill="none" stroke="${palette.mint}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="548" y="312" width="104" height="76" rx="10" fill="none" stroke="${palette.mint}" stroke-width="12"/>
      <rect x="300" y="530" width="600" height="84" rx="22" fill="#f3f4f3"/>
      <circle cx="600" cy="572" r="32" fill="${palette.blue}"/>
      <path d="M600 590V552 M586 565L600 551L614 565" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="583" y="566" width="34" height="27" rx="4" fill="none" stroke="#ffffff" stroke-width="6"/>
      <circle cx="600" cy="572" r="44" fill="none" stroke="${palette.blue}" stroke-width="5" stroke-dasharray="9 8"/>
      <text x="686" y="580" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="${palette.ink}">Tap Share</text>
    `)
  },
  {
    name: "iphone-install-menu.png",
    svg: shell(`
      <text x="600" y="136" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${palette.ink}">Share menu</text>
      <rect x="292" y="170" width="616" height="430" rx="28" fill="#f4f4f5"/>
      <g font-family="Arial, sans-serif" font-size="25" fill="${palette.ink}">
        <rect x="322" y="204" width="556" height="86" rx="17" fill="#ffffff"/>
        <path d="M366 226H410V268H366Z M374 238H402 M374 248H398 M374 258H394" fill="none" stroke="${palette.moss}" stroke-width="5" stroke-linecap="round"/>
        <text x="438" y="258">Add Bookmark</text>
        <rect x="312" y="305" width="576" height="106" rx="20" fill="#e4f4ef" stroke="${palette.mint}" stroke-width="4"/>
        <rect x="355" y="331" width="54" height="54" rx="10" fill="#ffffff" stroke="${palette.mint}" stroke-width="4"/>
        <path d="M382 342V374 M366 358H398" stroke="${palette.mint}" stroke-width="6" stroke-linecap="round"/>
        <text x="438" y="369" font-weight="700">Add to Home Screen</text>
        <rect x="322" y="426" width="556" height="86" rx="17" fill="#ffffff"/>
        <circle cx="382" cy="469" r="22" fill="none" stroke="${palette.moss}" stroke-width="5"/>
        <path d="M382 456V471L393 478" fill="none" stroke="${palette.moss}" stroke-width="5" stroke-linecap="round"/>
        <text x="438" y="478">Add to Reading List</text>
      </g>
      <text x="600" y="647" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="${palette.mint}">Scroll down if you do not see it immediately</text>
    `)
  },
  {
    name: "iphone-install-confirm.png",
    svg: shell(`
      <text x="600" y="137" text-anchor="middle" font-family="Arial, sans-serif" font-size="27" font-weight="700" fill="${palette.ink}">Add to Home Screen</text>
      <text x="302" y="137" font-family="Arial, sans-serif" font-size="23" font-weight="600" fill="${palette.blue}">Cancel</text>
      <rect x="826" y="98" width="92" height="55" rx="16" fill="${palette.blue}"/>
      <text x="872" y="134" text-anchor="middle" font-family="Arial, sans-serif" font-size="23" font-weight="700" fill="#ffffff">Add</text>
      <rect x="300" y="185" width="600" height="180" rx="24" fill="#f4f4f5"/>
      <rect x="330" y="215" width="118" height="118" rx="26" fill="${palette.mint}"/>
      <text x="389" y="290" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="800" fill="#ffffff">T</text>
      <text x="478" y="259" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${palette.ink}">Trade Invoice Tracker</text>
      <text x="478" y="299" font-family="Arial, sans-serif" font-size="21" fill="${palette.moss}">dhuss.vercel.app</text>
      <rect x="300" y="395" width="600" height="110" rx="22" fill="#f4f4f5"/>
      <text x="330" y="439" font-family="Arial, sans-serif" font-size="21" font-weight="700" fill="${palette.moss}">HOME SCREEN NAME</text>
      <text x="330" y="479" font-family="Arial, sans-serif" font-size="26" font-weight="600" fill="${palette.ink}">Trade Invoice Tracker</text>
      <path d="M866 80L912 110" stroke="${palette.mint}" stroke-width="6" stroke-linecap="round"/>
      <circle cx="872" cy="125" r="58" fill="none" stroke="${palette.mint}" stroke-width="5" stroke-dasharray="9 8"/>
      <text x="600" y="581" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${palette.mint}">Keep the name, then tap Add</text>
    `)
  },
  {
    name: "iphone-install-launch.png",
    svg: shell(`
      <rect x="270" y="92" width="660" height="510" rx="42" fill="#dfeae4"/>
      <circle cx="354" cy="150" r="7" fill="#ffffff" opacity="0.85"/>
      <circle cx="384" cy="150" r="7" fill="#ffffff" opacity="0.85"/>
      <circle cx="414" cy="150" r="7" fill="#ffffff" opacity="0.85"/>
      <g>
        <rect x="342" y="215" width="130" height="130" rx="31" fill="${palette.mint}"/>
        <text x="407" y="297" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="800" fill="#ffffff">T</text>
        <text x="407" y="382" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="${palette.ink}">Invoice Tracker</text>
      </g>
      <g opacity="0.45">
        <rect x="550" y="215" width="130" height="130" rx="31" fill="#ffffff"/>
        <rect x="758" y="215" width="130" height="130" rx="31" fill="#ffffff"/>
        <rect x="342" y="430" width="130" height="130" rx="31" fill="#ffffff"/>
        <rect x="550" y="430" width="130" height="130" rx="31" fill="#ffffff"/>
        <rect x="758" y="430" width="130" height="130" rx="31" fill="#ffffff"/>
      </g>
      <circle cx="407" cy="280" r="88" fill="none" stroke="${palette.mint}" stroke-width="6" stroke-dasharray="10 9"/>
      <text x="600" y="648" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="${palette.ink}">Open it from your Home Screen like any other app</text>
    `)
  }
];

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  assets.map(({ name, svg }) => sharp(Buffer.from(svg)).png().toFile(path.join(outputDirectory, name)))
);

console.log(`Generated ${assets.length} iPhone install guide images in ${outputDirectory}`);
