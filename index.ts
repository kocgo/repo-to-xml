import * as fs from "fs";
import * as path from "path";
import { minimatch } from "minimatch";

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

interface FileEntry {
  path: string;
  content: string;
}

const XML_ESCAPE_MAP: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "'": "&apos;",
  '"': "&quot;"
};

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (char) => XML_ESCAPE_MAP[char] || char);
}

async function readDirectory(
  dirPath: string,
  ignorePatterns: string[] = []
): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];

  async function walk(currentPath: string) {
    try {
      const files = await fs.promises.readdir(currentPath);

      await Promise.all(files.map(async (file: string) => {
        try {
          const fullPath = path.join(currentPath, file);
          const relativePath = path.relative(dirPath, fullPath);
          const stat = await fs.promises.stat(fullPath);

          // Skip if matches any ignore pattern
          const shouldIgnore = ignorePatterns.some((pattern) => {
            const matches = minimatch(relativePath, pattern, { matchBase: true });
            console.log(`Checking ${relativePath} against ${pattern}: ${matches}`);
            return matches;
          });

          if (shouldIgnore) {
            console.log(`Ignoring ${relativePath}`);
            return;
          }

          if (stat.isDirectory()) {
            await walk(fullPath);
          } else {
            const content = await fs.promises.readFile(fullPath, "utf-8");
            entries.push({
              path: relativePath,
              content: escapeXml(content),
            });
          }
        } catch (error) {
          console.error(`Error processing file ${file}: ${(error as Error).message}`);
        }
      }));
    } catch (error) {
      console.error(`Error reading directory ${currentPath}: ${(error as Error).message}`);
    }
  }

  try {
    await walk(dirPath);
  } catch (error) {
    console.error(`Error walking directory ${dirPath}: ${(error as Error).message}`);
  }
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

async function main() {
  if (process.argv.length < 3) {
    console.error(
      "Usage: tsx index.ts <directory-path> [--ignore pattern1 pattern2 ...]"
    );
    process.exit(1);
  }

  const dirPath = process.argv[2];

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

  const files = await readDirectory(dirPath, ignorePatterns);
  const xml = generateXml(files);

  const outputPath = path.join(process.cwd(), "repository.xml");
  fs.writeFileSync(outputPath, xml);
  console.log(`Repository XML generated at: ${outputPath}`);
}

main();
