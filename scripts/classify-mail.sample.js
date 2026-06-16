#!/usr/bin/env node

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", () => {
  const mail = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  const text = `${mail.folder || ""}\n${mail.subject || ""}\n${mail.bodyExcerpt || ""}`.toLowerCase();
  let level = 1;
  let label = "INTERNAL";
  let reason = "default sample classifier";
  if (text.includes("high registered") || text.includes("secret")) {
    level = 3;
    label = "HIGH REGISTERED";
    reason = "matched high registered keyword";
  } else if (text.includes("registered") || text.includes("confidential") || text.includes("contract") || text.includes("budget")) {
    level = 2;
    label = "REGISTERED";
    reason = "matched registered keyword";
  }
  process.stdout.write(JSON.stringify({ mailId: mail.mailId, level, label, source: "sample-script", reason }));
});
