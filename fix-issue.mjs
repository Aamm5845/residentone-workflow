import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const anthropic = new Anthropic();

const issue = {
  title: process.env.ISSUE_TITLE || '',
  description: process.env.ISSUE_DESCRIPTION || '',
  type: process.env.ISSUE_TYPE || '',
  priority: process.env.ISSUE_PRIORITY || '',
  consoleLog: process.env.ISSUE_CONSOLE_LOG || '',
  projectName: process.env.ISSUE_PROJECT_NAME || ''
};

console.log('Analyzing issue:', issue.title);
console.log('Description:', issue.description);

// Read relevant files based on issue context
async function getRelevantFiles() {
  const files = [];
  const keyPaths = ['src/app', 'src/components', 'src/lib', 'prisma/schema.prisma'];

  function walkDir(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.includes('node_modules') && !entry.name.startsWith('.')) {
          walkDir(fullPath, fileList);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx|prisma)$/.test(entry.name)) {
          fileList.push(fullPath);
        }
      }
    } catch (e) {}
    return fileList;
  }

  for (const keyPath of keyPaths) {
    const foundFiles = walkDir(keyPath);
    files.push(...foundFiles.slice(0, 50));
  }
  return files.slice(0, 100);
}

const relevantFiles = await getRelevantFiles();
const fileContents = [];

for (const filePath of relevantFiles.slice(0, 30)) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.length < 10000) {
      fileContents.push({ path: filePath, content });
    }
  } catch (e) {}
}

const prompt = `You are a senior developer fixing an urgent issue in a Next.js application.

ISSUE:
Title: ${issue.title}
Description: ${issue.description}
Type: ${issue.type}
Priority: ${issue.priority}
${issue.consoleLog ? `Console Log:\n${issue.consoleLog}` : ''}
${issue.projectName ? `Project: ${issue.projectName}` : ''}

CODEBASE FILES:
${fileContents.map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n')}

INSTRUCTIONS:
1. Analyze the issue and identify what needs to change
2. Provide a fix with the exact file changes needed
3. Format your response as JSON:
{
  "analysis": "Brief explanation of the changes",
  "files": [
    {
      "path": "path/to/file.ts",
      "action": "modify",
      "content": "full new file content"
    }
  ],
  "summary": "One sentence describing what was fixed"
}

Only include files that need changes. Provide complete file contents.
If you cannot determine a fix, return: {"analysis": "reason", "files": [], "summary": "Could not auto-fix"}`;

try {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  });

  const responseText = response.content[0].text;
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    console.log('No valid JSON in response');
    fs.writeFileSync('fix-result.json', JSON.stringify({ analysis: 'No valid response', files: [], summary: 'Could not auto-fix' }));
    process.exit(1);
  }

  const fix = JSON.parse(jsonMatch[0]);
  console.log('Analysis:', fix.analysis);
  console.log('Summary:', fix.summary);

  if (fix.files && fix.files.length > 0) {
    for (const file of fix.files) {
      const dir = path.dirname(file.path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(file.path, file.content);
      console.log('Updated:', file.path);
    }
  }

  fs.writeFileSync('fix-result.json', JSON.stringify(fix, null, 2));
} catch (error) {
  console.error('Error:', error.message);
  fs.writeFileSync('fix-result.json', JSON.stringify({ analysis: error.message, files: [], summary: 'Could not auto-fix' }));
  process.exit(1);
}
