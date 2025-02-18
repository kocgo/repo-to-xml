import fs from "fs";
import path from "path";
import { minimatch } from "minimatch";

interface FileEntry {
  path: string;
  content: string;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<":
        return "<";
      case ">":
        return ">";
      case "&":
        return "&";
      case "'":
        return "'";
      case '"':
        return `"`;
      default:
        return char;
    }
  });
}

function readDirectory(
  dirPath: string,
  ignorePatterns: string[] = []
): FileEntry[] {
  const entries: FileEntry[] = [];

  function walk(currentPath: string) {
    const files = fs.readdirSync(currentPath);

    for (const file of files) {
      const fullPath = path.join(currentPath, file);
      const relativePath = path.relative(dirPath, fullPath);
      const stat = fs.statSync(fullPath);

      // Skip if matches any ignore pattern
      let shouldIgnore = false;
      for (const pattern of ignorePatterns) {
        const matches = minimatch(relativePath, pattern, { matchBase: true });
        console.log(`Checking ${relativePath} against ${pattern}: ${matches}`);
        if (matches) {
          shouldIgnore = true;
          break;
        }
      }
      if (shouldIgnore) {
        console.log(`Ignoring ${relativePath}`);
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        const content = fs.readFileSync(fullPath, "utf-8");
        entries.push({
          path: relativePath,
          content: escapeXml(content),
        });
      }
    }
  }

  walk(dirPath);
  return entries;
}

function generateXml(files: FileEntry[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<repository>\n";

  for (const file of files) {
    xml += `  <file path="${file.path}">\n`;
    xml += `    <![CDATA[${file.content}]]>\n`;
    xml += "  </file>\n";
  }

  xml += "</repository>";
  return xml;
}

function main() {
  if (process.argv.length < 3) {
    console.error(
      "Usage: tsx index.ts <directory-path> [--ignore pattern1 pattern2 ...]"
    );
    process.exit(1);
  }

  const dirPath = process.argv[2];
  const ignorePatterns: string[] = [
    "node_modules",
    ".git",
    "*.jpg",
    "*.jpeg", 
    "*.png",
    "*.gif",
    "*.svg",
    "*.webp",
    "package-lock.json"
  ];
  console.log("Raw command line arguments:", process.argv);

  // Parse ignore patterns if --ignore flag is present
  const ignoreFlagIndex = process.argv.indexOf("--ignore");
  if (ignoreFlagIndex > -1) {
    const patterns = process.argv.slice(ignoreFlagIndex + 1);
    console.log("Parsed ignore patterns:", patterns);
    ignorePatterns.push(...patterns);
  }

  if (!fs.existsSync(dirPath)) {
    console.error(`Directory does not exist: ${dirPath}`);
    process.exit(1);
  }

  const files = readDirectory(dirPath, ignorePatterns);
  const xml = generateXml(files);

  const outputPath = path.join(process.cwd(), "repository.xml");
  fs.writeFileSync(outputPath, xml);
  console.log(`Repository XML generated at: ${outputPath}`);
}

main();
