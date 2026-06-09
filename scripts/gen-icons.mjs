#!/usr/bin/env node
/**
 * Renders app/icon.svg (the Gotham "G") into app/apple-icon.png and app/favicon.ico
 * using headless Chromium. Run: node scripts/gen-icons.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync(new URL("../app/icon.svg", import.meta.url), "utf8");

async function renderPng(size) {
  const sized = svg
    .replace(/width="\d+"/, `width="${size}"`)
    .replace(/height="\d+"/, `height="${size}"`);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;padding:0}svg{display:block}</style></head><body>${sized}</body></html>`,
    { waitUntil: "networkidle" },
  );
  const buf = await page.screenshot({
    clip: { x: 0, y: 0, width: size, height: size },
    omitBackground: false,
  });
  await browser.close();
  return buf;
}

/** Wrap a single PNG into a valid .ico (PNG-in-ICO; supported by all modern browsers). */
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(1, 4); // count
  const dir = Buffer.alloc(16);
  dir.writeUInt8(size >= 256 ? 0 : size, 0); // width
  dir.writeUInt8(size >= 256 ? 0 : size, 1); // height
  dir.writeUInt8(0, 2); // palette
  dir.writeUInt8(0, 3); // reserved
  dir.writeUInt16LE(1, 4); // planes
  dir.writeUInt16LE(32, 6); // bpp
  dir.writeUInt32LE(png.length, 8); // bytes
  dir.writeUInt32LE(22, 12); // offset
  return Buffer.concat([header, dir, png]);
}

const apple = await renderPng(180);
writeFileSync(new URL("../app/apple-icon.png", import.meta.url), apple);
console.log("wrote app/apple-icon.png (180x180,", apple.length, "bytes)");

const fav = await renderPng(64);
writeFileSync(new URL("../app/favicon.ico", import.meta.url), pngToIco(fav, 64));
console.log("wrote app/favicon.ico (64x64 PNG-in-ICO)");
