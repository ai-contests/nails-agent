const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../docs/design-diagrams.md');
const content = fs.readFileSync(filePath, 'utf8');

// Extract mermaid blocks
const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g;
const matches = [];
let match;
while ((match = mermaidRegex.exec(content)) !== null) {
  matches.push(match[1]);
}

const titles = [
  'ERD Diagram',
  'C-Side User Journey (UserFlow)',
  'B-Side Agent Operation Flow',
  'E2E System Data Flow'
];

let output = '';
matches.forEach((mermaidCode, index) => {
  const payload = {
    type: 'mermaid',
    data: mermaidCode.trim()
  };
  const jsonStr = JSON.stringify(payload);
  const encoded = encodeURIComponent(jsonStr);
  const drawioUrl = `https://app.diagrams.net/?create=${encoded}`;
  
  output += `=== ${titles[index]} ===\n`;
  output += `Length: ${drawioUrl.length}\n`;
  output += `${drawioUrl}\n\n`;
});

fs.writeFileSync(path.join(__dirname, 'drawio_links.txt'), output);
console.log('Successfully wrote links to scripts/drawio_links.txt');
