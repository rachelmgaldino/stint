import { writeFileSync, readFileSync } from 'fs';
const looks = {
tide: {
 day: { ground:'#f1e6d3', surface:'#fffaf1', sunken:'#ebdfca', soft:'#f6eddf', raised:'#ebdfca', line:'#e0d0b6', text:'#17384a', muted:'#4f6a75', placeholder:'#7a8c92', seed:'#d8c8ac', petal:'#d9eeeb', track:'#cde4e1', ink:'#17384a', 'ink-lip':'#0b2330', 'on-ink':'#fffaf1', 'on-pastel':'#17384a',
  apricot:'#f2937c', 'apricot-lip':'#cf6b55', peri:'#8fc9d9', 'peri-lip':'#4f9bb0', matcha:'#a8d8c4', 'matcha-lip':'#6db39a', lemon:'#f6d28b', 'lemon-lip':'#d4a956', bubblegum:'#f3b2b8', 'bubblegum-lip':'#d07f88', sky:'#a6d9e6', danger:'#c2453f', scrim:'rgb(23 56 74 / 0.38)',
  'break-stage':'#d9eeeb', 'break-text':'#1d4a50', 'break-eyebrow':'#2e7a78', 'break-petal':'#c2e2de', 'break-track':'#8ccbc5',
  heading:'"Baloo 2 Variable", "Segoe UI", system-ui, sans-serif', body:'"Nunito Variable", "Segoe UI", system-ui, sans-serif',
  sticker:'#fffaf1', dots:'#e6d8c0', bar:'#17384a', 'bar-text':'#fffaf1', 'bar-ring':'0px', 'bar-edge':'transparent', 'bar-shadow':'rgb(23 56 74 / 0.3)', 'bar-deep':'#17384a', 'bar-deep-text':'#fffaf1', shade:'23 56 74', rose:'#ef8f9a' },
 night: { ground:'#0c2233', surface:'#12304a', sunken:'#0f2a3f', soft:'#1a3c58', raised:'#1a3c58', line:'#24496a', text:'#e6f6f5', muted:'#9cc2c9', placeholder:'#7799a6', seed:'#2a4f6c', petal:'#133a55', track:'#24496a', ink:'#e6f6f5', 'ink-lip':'#9cc2c9', 'on-ink':'#0c2233', danger:'#f39a8f', scrim:'rgb(4 12 20 / 0.6)',
  'break-stage':'#0f3338', 'break-text':'#c9efe9', 'break-eyebrow':'#7fe0cf', 'break-petal':'#164248', 'break-track':'#2a6b66', sticker:'#24496a', dots:'#1d4c6a', bar:'#1a3c58', 'bar-text':'#e6f6f5', 'bar-ring':'1px', 'bar-edge':'#24496a', 'bar-shadow':'rgb(2 8 14 / 0.5)' } },
pixel: {
 day: { ground:'#dfe8c4', surface:'#f4f7e6', sunken:'#d6e0b8', soft:'#e9efd3', raised:'#d6e0b8', line:'#b9c98e', text:'#233016', muted:'#56693a', placeholder:'#7b8c5c', seed:'#b9c98e', petal:'#d6e0b8', track:'#c4d39c', ink:'#233016', 'ink-lip':'#0f170a', 'on-ink':'#f4f7e6', 'on-pastel':'#233016',
  apricot:'#f0807a', 'apricot-lip':'#b84744', peri:'#7fb2e3', 'peri-lip':'#3f74a8', matcha:'#9ad67a', 'matcha-lip':'#5a9a3c', lemon:'#f5c84c', 'lemon-lip':'#c49522', bubblegum:'#f29ac0', 'bubblegum-lip':'#c4688f', sky:'#8ad1e0', danger:'#c03a2b', scrim:'rgb(35 48 22 / 0.4)',
  'break-stage':'#cfe5b5', 'break-text':'#233016', 'break-eyebrow':'#3d6b25', 'break-petal':'#bcd99c', 'break-track':'#8ccf6b',
  heading:'"Pixelify Sans Variable", monospace', body:'"JetBrains Mono Variable", ui-monospace, monospace',
  sticker:'#233016', dots:'#d2ddb3', bar:'#233016', 'bar-text':'#f4f7e6', 'bar-ring':'3px', 'bar-edge':'#233016', 'bar-shadow':'rgb(35 48 22 / 0.35)', 'bar-deep':'#233016', 'bar-deep-text':'#f4f7e6', shade:'35 48 22', rose:'#f0807a', hard:'#233016' },
 night: { ground:'#14121f', surface:'#1e1b2e', sunken:'#18162a', soft:'#2a2640', raised:'#2a2640', line:'#3b3658', text:'#e9f5d0', muted:'#a7b38c', placeholder:'#7e8a68', seed:'#3b3658', petal:'#221f35', track:'#332e4d', ink:'#b6f36b', 'ink-lip':'#6fb52f', 'on-ink':'#14121f', danger:'#ff6b6b', scrim:'rgb(4 3 10 / 0.65)',
  'break-stage':'#172a1f', 'break-text':'#c9f5c0', 'break-eyebrow':'#8cf07a', 'break-petal':'#1f3a2a', 'break-track':'#3d7a4c', sticker:'#b6f36b', dots:'#1b1929', bar:'#1e1b2e', 'bar-text':'#e9f5d0', 'bar-edge':'#b6f36b', 'bar-shadow':'rgb(0 0 0 / 0.5)', hard:'#000000' } },
notebook: {
 day: { ground:'#efe8d8', surface:'#fffdf6', sunken:'#f3eee0', soft:'#f8f4ea', raised:'#f3eee0', line:'#ddd5c2', text:'#263a6e', muted:'#5a6890', placeholder:'#8590b0', seed:'#d5cdb9', petal:'#fff6c4', track:'#ebe4d2', ink:'#263a6e', 'ink-lip':'#15214a', 'on-ink':'#fffdf6', 'on-pastel':'#263a6e',
  apricot:'#ffdf5e', 'apricot-lip':'#263a6e', peri:'#a9c4f5', 'peri-lip':'#263a6e', matcha:'#b7e3a1', 'matcha-lip':'#263a6e', lemon:'#ffc99a', 'lemon-lip':'#263a6e', bubblegum:'#ffb3c7', 'bubblegum-lip':'#263a6e', sky:'#a9d8f5', danger:'#d1453b', scrim:'rgb(38 58 110 / 0.32)',
  'break-stage':'#eaf5df', 'break-text':'#263a6e', 'break-eyebrow':'#3f7a3a', 'break-petal':'#d6edc6', 'break-track':'#b7e3a1',
  heading:'"Shantell Sans Variable", "Comic Sans MS", cursive', body:'"Lexend Variable", "Segoe UI", system-ui, sans-serif',
  sticker:'#fffdf6', dots:'#d9e3f3', bar:'#263a6e', 'bar-text':'#fffdf6', 'bar-ring':'2px', 'bar-edge':'#263a6e', 'bar-shadow':'rgb(38 58 110 / 0.25)', 'bar-deep':'#263a6e', 'bar-deep-text':'#fffdf6', shade:'38 58 110', rose:'#f28da6', margin:'#f2a3a3', pen:'#263a6e' },
 night: { ground:'#1f2b27', surface:'#273631', sunken:'#22302b', soft:'#2f3f39', raised:'#2f3f39', line:'#41544c', text:'#f2efe6', muted:'#b8c2b8', placeholder:'#8c988e', seed:'#41544c', petal:'#2c3d37', track:'#3a4c45', ink:'#f2efe6', 'ink-lip':'#b8c2b8', 'on-ink':'#1f2b27', 'on-pastel':'#1f2b27', 'apricot-lip':'#f2efe6', 'peri-lip':'#f2efe6', 'matcha-lip':'#f2efe6', 'lemon-lip':'#f2efe6', 'bubblegum-lip':'#f2efe6', danger:'#ff9b8f', scrim:'rgb(6 12 10 / 0.6)',
  'break-stage':'#22372c', 'break-text':'#e3f2d8', 'break-eyebrow':'#b7e3a1', 'break-petal':'#2b4535', 'break-track':'#4f7a55', sticker:'#273631', dots:'#2a3833', bar:'#2f3f39', 'bar-text':'#f2efe6', 'bar-edge':'#f2efe6', 'bar-shadow':'rgb(0 0 0 / 0.4)', margin:'#8a5a5a', pen:'#f2efe6' } },
orbit: {
 day: { ground:'#e3e6fa', surface:'#f8f8ff', sunken:'#e9ebfb', soft:'#f0f1fd', raised:'#e9ebfb', line:'#d6d9f2', text:'#1d2150', muted:'#565b8c', placeholder:'#7e83ad', seed:'#cdd1ef', petal:'#eceefd', track:'#e0e3f8', ink:'#1d2150', 'ink-lip':'#0c0f33', 'on-ink':'#f8f8ff', 'on-pastel':'#1d2150',
  apricot:'#ffa877', 'apricot-lip':'#e07a45', peri:'#a3acff', 'peri-lip':'#6e78e0', matcha:'#93e2cc', 'matcha-lip':'#55b79b', lemon:'#ffd873', 'lemon-lip':'#d9aa3a', bubblegum:'#ffa6cb', 'bubblegum-lip':'#e06d9e', sky:'#9fd8ff', danger:'#d43f6a', scrim:'rgb(29 33 80 / 0.4)',
  'break-stage':'#dcf5ee', 'break-text':'#1b4a44', 'break-eyebrow':'#2b8a77', 'break-petal':'#c6eee3', 'break-track':'#93e2cc',
  heading:'"Unbounded Variable", "Segoe UI", system-ui, sans-serif', body:'"Outfit Variable", "Segoe UI", system-ui, sans-serif',
  sticker:'#f8f8ff', dots:'#c3c8ef', bar:'#1d2150', 'bar-text':'#f8f8ff', 'bar-ring':'0px', 'bar-edge':'transparent', 'bar-shadow':'rgb(29 33 80 / 0.35)', 'bar-deep':'#1d2150', 'bar-deep-text':'#f8f8ff', shade:'29 33 80', rose:'#ff8fb8', glow:'rgb(255 168 119 / 0.45)' },
 night: { ground:'#090b20', surface:'#131638', sunken:'#0f1230', soft:'#1c2050', raised:'#1c2050', line:'#272c62', text:'#eef0ff', muted:'#a3a8d6', placeholder:'#7a80b3', seed:'#2c3170', petal:'#12153a', track:'#222760', ink:'#eef0ff', 'ink-lip':'#a3a8d6', 'on-ink':'#131638', danger:'#ff8fae', scrim:'rgb(2 3 12 / 0.65)',
  'break-stage':'#0e2a35', 'break-text':'#c8f3ea', 'break-eyebrow':'#93e2cc', 'break-petal':'#123744', 'break-track':'#2a6b73', sticker:'#272c62', dots:'#ffffff', bar:'#131638', 'bar-text':'#eef0ff', 'bar-ring':'1px', 'bar-edge':'#2c3170', 'bar-shadow':'rgb(120 130 255 / 0.35)', glow:'rgb(255 168 119 / 0.55)' } },
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
css += readFileSync('/tmp/claude-0/gen/extra.css','utf8');
writeFileSync('/home/claude/stint/src/looks-proto.css', css);
