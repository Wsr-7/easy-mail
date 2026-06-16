export interface DigestMetadata {
  generatedAt: string;
  rangeMode: string;
  recentHours: number;
  maxItems: number;
  folders: string[];
}

export interface DigestItem {
  mailId: string;
  subject: string;
  from: string;
  receivedTime: string;
  folder: string;
  unread: string;
  importance: string;
  toMe: string;
  ccMe: string;
  bodyExcerpt: string;
}

export interface DigestData {
  metadata: DigestMetadata;
  items: DigestItem[];
}

export function parseDigest(markdown: string): DigestData {
  const text = String(markdown || "").replace(/\r\n/g, "\n");
  const metadata: DigestMetadata = {
    generatedAt: "",
    rangeMode: "",
    recentHours: 0,
    maxItems: 0,
    folders: []
  };

  const metadataMatch = text.match(
    /GeneratedAt:\s*(.+)\nRangeMode:\s*(.+)\nRecentHours:\s*(.+)\nMaxItems:\s*(.+)\nFolders:\n([\s\S]*?)\n---/
  );

  if (metadataMatch) {
    metadata.generatedAt = metadataMatch[1].trim();
    metadata.rangeMode = metadataMatch[2].trim();
    metadata.recentHours = Number(metadataMatch[3].trim()) || 0;
    metadata.maxItems = Number(metadataMatch[4].trim()) || 0;
    metadata.folders = metadataMatch[5]
      .split("\n")
      .map((line) => line.replace(/^- /, "").trim())
      .filter(Boolean);
  }

  const sections = text.split(/\n## Mail:\s+/).slice(1);
  const items = sections.map((section) => parseMailSection(section)).filter(Boolean) as DigestItem[];
  return { metadata, items };
}

function parseMailSection(section: string): DigestItem | null {
  const text = String(section || "");
  const bodyParts = text.split(/\nBodyExcerpt:\n/);
  const headerText = bodyParts[0] || "";
  const bodyText = (bodyParts[1] || "").replace(/\n---\s*$/, "").trim();
  const lines = headerText.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) {
    return null;
  }

  const result: DigestItem = {
    mailId: lines[0],
    subject: "",
    from: "",
    receivedTime: "",
    folder: "",
    unread: "",
    importance: "",
    toMe: "",
    ccMe: "",
    bodyExcerpt: bodyText
  };

  for (const line of lines.slice(1)) {
    assignIfPrefix(result, line, "Subject: ", "subject");
    assignIfPrefix(result, line, "From: ", "from");
    assignIfPrefix(result, line, "ReceivedTime: ", "receivedTime");
    assignIfPrefix(result, line, "Folder: ", "folder");
    assignIfPrefix(result, line, "Unread: ", "unread");
    assignIfPrefix(result, line, "Importance: ", "importance");
    assignIfPrefix(result, line, "ToMe: ", "toMe");
    assignIfPrefix(result, line, "CcMe: ", "ccMe");
  }

  return result;
}

function assignIfPrefix(target: DigestItem, line: string, prefix: string, key: keyof DigestItem): void {
  if (line.startsWith(prefix)) {
    target[key] = line.slice(prefix.length).trim() as never;
  }
}

