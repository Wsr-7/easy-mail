#!/usr/bin/env node

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const mail = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  const text = `${mail.folder || ""}\n${mail.subject || ""}\n${mail.bodyExcerpt || ""}`.toLowerCase();
  let level = 1;
  let label = "Internal";
  let reason = "default sample classifier";
  if (text.includes("restricted")) {
    level = 3;
    label = "Restricted";
    reason = "matched restricted keyword";
  } else if (text.includes("confidential") || text.includes("contract") || text.includes("budget")) {
    level = 2;
    label = "Confidential";
    reason = "matched confidential keyword";
  }
  process.stdout.write(JSON.stringify({ mailId: mail.mailId, level, label, source: "sample-script", reason }));
});
