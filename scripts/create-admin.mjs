import readline from "node:readline";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function readLine(prompt) {
  return new Promise((resolve) => {
    const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
    terminal.question(prompt, (answer) => { terminal.close(); resolve(answer); });
  });
}

function readPassword(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    return Promise.reject(new Error("Run create-admin in an interactive terminal so the password can be hidden."));
  }
  return new Promise((resolve, reject) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    let value = "";
    const onData = (chunk) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") { cleanup(); reject(new Error("Cancelled")); return; }
        if (char === "\r" || char === "\n") { cleanup(); process.stdout.write("\n"); resolve(value); return; }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    function cleanup() { stdin.off("data", onData); stdin.setRawMode(false); stdin.pause(); }
    stdin.on("data", onData);
  });
}

try {
  const email = (await readLine("Admin email: ")).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  const password = await readPassword("Password (minimum 12 characters): ");
  if (password.length < 12) throw new Error("Password must be at least 12 characters long.");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.deleteMany({ where: { email: { not: email } } });
  await prisma.adminUser.upsert({ where: { email }, create: { email, passwordHash }, update: { passwordHash } });
  console.log(`Admin account updated for ${email}.`);
} finally {
  await prisma.$disconnect();
}
