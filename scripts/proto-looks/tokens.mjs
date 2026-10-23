import { writeFileSync, readFileSync } from 'fs';
const looks = {
notebook: {
 day: { ground:'#efe8d8', surface:'#fffdf6', sunken:'#f3eee0', soft:'#f8f4ea', raised:'#f3eee0', line:'#ddd5c2', text:'#263a6e', muted:'#5a6890', placeholder:'#8590b0', seed:'#d5cdb9', petal:'#fff6c4', track:'#ebe4d2', ink:'#263a6e', 'ink-lip':'#15214a', 'on-ink':'#fffdf6', 'on-pastel':'#263a6e',
  apricot:'#ffdf5e', 'apricot-lip':'#263a6e', peri:'#a9c4f5', 'peri-lip':'#263a6e', matcha:'#b7e3a1', 'matcha-lip':'#263a6e', lemon:'#ffc99a', 'lemon-lip':'#263a6e', bubblegum:'#ffb3c7', 'bubblegum-lip':'#263a6e', sky:'#a9d8f5', danger:'#d1453b', scrim:'rgb(38 58 110 / 0.32)',
  'break-stage':'#eaf5df', 'break-text':'#263a6e', 'break-eyebrow':'#3f7a3a', 'break-petal':'#d6edc6', 'break-track':'#b7e3a1',
  heading:'"Shantell Sans Variable", "Comic Sans MS", cursive', body:'"Lexend Variable", "Segoe UI", system-ui, sans-serif',
  sticker:'#fffdf6', dots:'#d9e3f3', bar:'#263a6e', 'bar-text':'#fffdf6', 'bar-ring':'2px', 'bar-edge':'#263a6e', 'bar-shadow':'rgb(38 58 110 / 0.25)', 'bar-deep':'#263a6e', 'bar-deep-text':'#fffdf6', shade:'38 58 110', rose:'#f28da6', margin:'#f2a3a3', pen:'#263a6e' },
 night: { ground:'#1f2b27', surface:'#273631', sunken:'#22302b', soft:'#2f3f39', raised:'#2f3f39', line:'#41544c', text:'#f2efe6', muted:'#b8c2b8', placeholder:'#8c988e', seed:'#41544c', petal:'#2c3d37', track:'#3a4c45', ink:'#f2efe6', 'ink-lip':'#b8c2b8', 'on-ink':'#1f2b27', 'on-pastel':'#1f2b27', 'apricot-lip':'#f2efe6', 'peri-lip':'#f2efe6', 'matcha-lip':'#f2efe6', 'lemon-lip':'#f2efe6', 'bubblegum-lip':'#f2efe6', danger:'#ff9b8f', scrim:'rgb(6 12 10 / 0.6)',
  'break-stage':'#22372c', 'break-text':'#e3f2d8', 'break-eyebrow':'#b7e3a1', 'break-petal':'#2b4535', 'break-track':'#4f7a55', sticker:'#273631', dots:'#2a3833', bar:'#2f3f39', 'bar-text':'#f2efe6', 'bar-edge':'#f2efe6', 'bar-shadow':'rgb(0 0 0 / 0.4)', margin:'#8a5a5a', pen:'#f2efe6' } },
luna: {
 day: { ground:'#e4e6f0', surface:'#fbfbfe', sunken:'#eceef6', soft:'#f3f4fa', raised:'#eceef6', line:'#d9dbe9', text:'#262848', muted:'#5d6283', placeholder:'#8689a6', seed:'#cfd2e4', petal:'#eef0f8', track:'#e2e4f0', ink:'#262848', 'ink-lip':'#12142b', 'on-ink':'#fbfbfe', 'on-pastel':'#262848',
  apricot:'#f1cf7d', 'apricot-lip':'#c9a24a', peri:'#b3b8f0', 'peri-lip':'#7f86d6', matcha:'#b6dccb', 'matcha-lip':'#7fb79d', lemon:'#f6e3a8', 'lemon-lip':'#d4bb6a', bubblegum:'#f2c4d6', 'bubblegum-lip':'#d58fab', sky:'#b8d6ef', danger:'#c4506e', scrim:'rgb(38 40 72 / 0.38)',
  'break-stage':'#e2f1ea', 'break-text':'#2c4a40', 'break-eyebrow':'#3f7a63', 'break-petal':'#cfe8dc', 'break-track':'#b6dccb',
  heading:'"Instrument Serif", Georgia, serif', body:'"DM Sans Variable", "Segoe UI", system-ui, sans-serif',
  sticker:'#fbfbfe', dots:'#c9cce2', bar:'#262848', 'bar-text':'#fbfbfe', 'bar-ring':'0px', 'bar-edge':'transparent', 'bar-shadow':'rgb(38 40 72 / 0.3)', 'bar-deep':'#262848', 'bar-deep-text':'#fbfbfe', shade:'38 40 72', rose:'#e58fa9', 'moon-dark':'#d9dbe9', 'moon-lit':'#e3bd5c', hair:'rgb(38 40 72 / 0.1)' },
 night: { ground:'#0f1126', surface:'#181b36', sunken:'#14162e', soft:'#222647', raised:'#222647', line:'#2d3157', text:'#f3efe2', muted:'#aeb0cc', placeholder:'#8487a8', seed:'#33375f', petal:'#151830', track:'#262a4d', ink:'#f3efe2', 'ink-lip':'#aeb0cc', 'on-ink':'#181b36', danger:'#ef8fa9', scrim:'rgb(4 5 14 / 0.62)',
  'break-stage':'#132a2a', 'break-text':'#d4efe3', 'break-eyebrow':'#b6dccb', 'break-petal':'#18332f', 'break-track':'#3e6b5d', sticker:'#2d3157', dots:'#ffffff', bar:'#222647', 'bar-text':'#f3efe2', 'bar-ring':'1px', 'bar-edge':'#33375f', 'bar-shadow':'rgb(0 0 0 / 0.5)', 'moon-dark':'#2b2f55', 'moon-lit':'#f1dc9f', hair:'rgb(243 239 226 / 0.08)' } },
riso: {
 day: { ground:'#f2ede1', surface:'#fbf8f0', sunken:'#ece6d6', soft:'#f6f2e8', raised:'#ece6d6', line:'#ddd5c1', text:'#1d2a78', muted:'#4d5899', placeholder:'#7f86b4', seed:'#d8cfba', petal:'#ffd9e8', track:'#efe7d6', ink:'#1d2a78', 'ink-lip':'#ff5fa2', 'on-ink':'#fbf8f0', 'on-pastel':'#1d2a78',
  apricot:'#ff6fa8', 'apricot-lip':'#2f45e0', peri:'#5b73ff', 'peri-lip':'#ff6fa8', matcha:'#4fd1a1', 'matcha-lip':'#2f45e0', lemon:'#ffd23f', 'lemon-lip':'#ff6fa8', bubblegum:'#ffd23f', 'bubblegum-lip':'#2f45e0', sky:'#7fc8ff', danger:'#e5303f', scrim:'rgb(29 42 120 / 0.35)',
  'break-stage':'#d6f3e6', 'break-text':'#1d2a78', 'break-eyebrow':'#1d7a5c', 'break-petal':'#b6ead3', 'break-track':'#4fd1a1',
  heading:'"Syne Variable", "Segoe UI", system-ui, sans-serif', body:'"Space Grotesk Variable", "Segoe UI", system-ui, sans-serif',
  sticker:'#fbf8f0', dots:'rgb(255 95 162 / 0.28)', bar:'#1d2a78', 'bar-text':'#fbf8f0', 'bar-ring':'0px', 'bar-edge':'transparent', 'bar-shadow':'rgb(255 95 162 / 0.9)', 'bar-deep':'#1d2a78', 'bar-deep-text':'#fbf8f0', shade:'29 42 120', rose:'#ff6fa8', offset:'#ff6fa8' },
 night: { ground:'#141219', surface:'#1e1b26', sunken:'#191720', soft:'#272331', raised:'#272331', line:'#363044', text:'#f2ede1', muted:'#b9b2c8', placeholder:'#8a839a', seed:'#3a3448', petal:'#2a1f30', track:'#2b2636', ink:'#f2ede1', 'ink-lip':'#ff5fa2', 'on-ink':'#141219', danger:'#ff7b86', scrim:'rgb(0 0 0 / 0.6)',
  'break-stage':'#14271f', 'break-text':'#d6f3e6', 'break-eyebrow':'#4fd1a1', 'break-petal':'#1b3a2c', 'break-track':'#2d7a5c', sticker:'#1e1b26', dots:'rgb(255 95 162 / 0.16)', bar:'#1e1b26', 'bar-text':'#f2ede1', 'bar-shadow':'rgb(255 95 162 / 0.8)', offset:'#5b73ff' } },
};
const block = (o) => Object.entries(o).map(([k,v]) => `  --${k}: ${v};`).join('\n');
let css = '/* Prototype looks for the new-theme mockups. Generated. */\n\n';
for (const [n, {day, night}] of Object.entries(looks)) {
  css += `:root[data-look="${n}"] {\n${block(day)}\n}\n\n`;
  css += `@media (prefers-color-scheme: dark) {\n  :root[data-look="${n}"]:not([data-theme="light"]) {\n${block(night).replace(/^/gm,'  ')}\n  }\n}\n\n`;
  css += `:root[data-look="${n}"][data-theme="dark"],\n:root[data-look="${n}"] .shell[data-mode="focus"],\n:root[data-look="${n}"] .night {\n${block(night)}\n}\n\n`;
}

// Night colours to try for Notebook, picked with ?night=<name>.
const nights = {
  graphite: { ground:'#232429', surface:'#2c2d33', sunken:'#27282d', soft:'#35363d', raised:'#35363d', line:'#45464e', text:'#ecebe6', muted:'#b4b3ae', placeholder:'#8d8c88', seed:'#47484f', petal:'#303137', track:'#3b3c43', ink:'#ecebe6', 'ink-lip':'#b4b3ae', 'on-ink':'#232429', pen:'#ecebe6', margin:'#7d5656', dots:'rgb(236 235 230 / 0.05)', 'break-stage':'#2a3330', 'break-text':'#e3f2d8', 'break-eyebrow':'#b7e3a1', 'break-petal':'#323d39', 'break-track':'#4f6a5a', sticker:'#2c2d33', bar:'#35363d', 'bar-text':'#ecebe6', 'bar-edge':'#ecebe6' },
  blueprint: { ground:'#16284a', surface:'#1d3359', sunken:'#192d51', soft:'#253e69', raised:'#253e69', line:'#2f4b7d', text:'#eaf2ff', muted:'#a9c0e2', placeholder:'#7f97bd', seed:'#34507f', petal:'#1a3054', track:'#2a4573', ink:'#eaf2ff', 'ink-lip':'#a9c0e2', 'on-ink':'#16284a', pen:'#eaf2ff', margin:'#6f8fc8', dots:'rgb(234 242 255 / 0.07)', 'break-stage':'#183a4a', 'break-text':'#dff4ec', 'break-eyebrow':'#b7e3a1', 'break-petal':'#1f4656', 'break-track':'#3f7a7a', sticker:'#1d3359', bar:'#253e69', 'bar-text':'#eaf2ff', 'bar-edge':'#eaf2ff' },
  espresso: { ground:'#2a211c', surface:'#342a24', sunken:'#2f2520', soft:'#3e332c', raised:'#3e332c', line:'#4f4239', text:'#f4eadd', muted:'#c6b6a4', placeholder:'#9a8a7a', seed:'#54473d', petal:'#382d27', track:'#463a32', ink:'#f4eadd', 'ink-lip':'#c6b6a4', 'on-ink':'#2a211c', pen:'#f4eadd', margin:'#9b5f52', dots:'rgb(244 234 221 / 0.05)', 'break-stage':'#2f3328', 'break-text':'#e6f0d4', 'break-eyebrow':'#b7e3a1', 'break-petal':'#3a3f31', 'break-track':'#5e6b4a', sticker:'#342a24', bar:'#3e332c', 'bar-text':'#f4eadd', 'bar-edge':'#f4eadd' },
  burgundy: { ground:'#2a161c', surface:'#351d25', sunken:'#2f1920', soft:'#42252f', raised:'#42252f', line:'#552f3c', text:'#f7eaec', muted:'#cfaeb5', placeholder:'#a3848b', seed:'#5a3442', petal:'#3a2029', track:'#4a2a35', ink:'#f7eaec', 'ink-lip':'#cfaeb5', 'on-ink':'#2a161c', pen:'#f7eaec', margin:'#c77d8c', dots:'rgb(247 234 236 / 0.05)', 'break-stage':'#2f2a2a', 'break-text':'#e9f0dc', 'break-eyebrow':'#b7e3a1', 'break-petal':'#3a3433', 'break-track':'#62674f', sticker:'#351d25', bar:'#42252f', 'bar-text':'#f7eaec', 'bar-edge':'#f7eaec' },
};
for (const [n, t] of Object.entries(nights)) {
  const sel = `:root[data-look="notebook"][data-night="${n}"]`;
  css += `@media (prefers-color-scheme: dark) {\n  ${sel}:not([data-theme="light"]) {\n${block(t).replace(/^/gm,'  ')}\n  }\n}\n\n`;
  css += `${sel}[data-theme="dark"],\n${sel} .shell[data-mode="focus"] {\n${block(t)}\n}\n\n`;
}
css += readFileSync(new URL('./extra.css', import.meta.url),'utf8');
writeFileSync('/home/claude/stint/src/looks-proto.css', css);
