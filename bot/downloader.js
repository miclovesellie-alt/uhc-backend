const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const TEMP_DIR = path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const MAX_SIZE_BYTES = 49 * 1024 * 1024; // 49 MB — just under Telegram's 50 MB bot limit

/**
 * Detects the social platform from a URL string.
 */
function detectPlatform(url) {
  if (/tiktok\.com/i.test(url))      return "tiktok";
  if (/instagram\.com/i.test(url))   return "instagram";
  if (/youtu\.be|youtube\.com/i.test(url)) return "youtube";
  if (/twitter\.com|x\.com/i.test(url))   return "twitter";
  if (/reddit\.com/i.test(url))      return "reddit";
  if (/pinterest\.com/i.test(url))   return "pinterest";
  if (/facebook\.com|fb\.watch/i.test(url)) return "facebook";
  if (/snapchat\.com/i.test(url))    return "snapchat";
  if (/vimeo\.com/i.test(url))       return "vimeo";
  return "other";
}

/**
 * Downloads media from a URL using yt-dlp.
 * @param {string} url   - The social media URL
 * @param {string} format - 'video' | 'audio'
 * @returns {Promise<{ filePath: string, platform: string, title: string }>}
 */
function downloadMedia(url, format = "video") {
  return new Promise((resolve, reject) => {
    const id = crypto.randomBytes(8).toString("hex");
    const platform = detectPlatform(url);

    let outputTemplate, ytdlpArgs;

    if (format === "audio") {
      outputTemplate = path.join(TEMP_DIR, `${id}.%(ext)s`);
      ytdlpArgs = [
        `yt-dlp`,
        `--no-playlist`,
        `-x`,                         // extract audio
        `--audio-format mp3`,
        `--audio-quality 0`,
        `--output "${outputTemplate}"`,
        `--print-json`,
        `--no-warnings`,
        `"${url}"`,
      ].join(" ");
    } else {
      outputTemplate = path.join(TEMP_DIR, `${id}.%(ext)s`);
      ytdlpArgs = [
        `yt-dlp`,
        `--no-playlist`,
        `-f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"`,
        `--merge-output-format mp4`,
        `--output "${outputTemplate}"`,
        `--print-json`,
        `--no-warnings`,
        `"${url}"`,
      ].join(" ");
    }

    exec(ytdlpArgs, { timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) {
        console.error("[Bot Downloader] yt-dlp error:", stderr || err.message);
        return reject(new Error(stderr || err.message || "Download failed"));
      }

      // Parse the JSON output to get the actual filename
      let info = {};
      try {
        // yt-dlp may print multiple JSON objects; take the last valid one
        const lines = stdout.trim().split("\n").filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          try { info = JSON.parse(lines[i]); break; } catch (_) { /* skip */ }
        }
      } catch (_) {}

      // Find the actual output file (yt-dlp replaces %(ext)s)
      const ext = format === "audio" ? "mp3" : (info._filename?.split(".").pop() || "mp4");
      let filePath = path.join(TEMP_DIR, `${id}.${ext}`);

      // Fallback: scan temp dir for the file starting with our id
      if (!fs.existsSync(filePath)) {
        const found = fs.readdirSync(TEMP_DIR).find(f => f.startsWith(id));
        if (found) filePath = path.join(TEMP_DIR, found);
        else return reject(new Error("Downloaded file not found on disk"));
      }

      // Size guard
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_SIZE_BYTES) {
        fs.unlinkSync(filePath);
        return reject(Object.assign(new Error("FILE_TOO_LARGE"), { code: "FILE_TOO_LARGE", url }));
      }

      resolve({
        filePath,
        platform,
        title: info.title || info.fulltitle || "Media",
      });
    });
  });
}

/**
 * Deletes a temp file silently.
 */
function cleanup(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

module.exports = { downloadMedia, detectPlatform, cleanup };
