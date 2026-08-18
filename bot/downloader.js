const ytDlp = require("yt-dlp-exec");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const TEMP_DIR = path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const MAX_SIZE_BYTES = 49 * 1024 * 1024; // 49 MB — just under Telegram's 50 MB limit

/**
 * Detects the social platform from a URL string.
 */
function detectPlatform(url) {
  if (/tiktok\.com/i.test(url))           return "tiktok";
  if (/instagram\.com/i.test(url))        return "instagram";
  if (/youtu\.be|youtube\.com/i.test(url)) return "youtube";
  if (/twitter\.com|x\.com/i.test(url))   return "twitter";
  if (/reddit\.com/i.test(url))           return "reddit";
  if (/pinterest\.com/i.test(url))        return "pinterest";
  if (/facebook\.com|fb\.watch/i.test(url)) return "facebook";
  if (/snapchat\.com/i.test(url))         return "snapchat";
  if (/vimeo\.com/i.test(url))            return "vimeo";
  return "other";
}

/**
 * Downloads media from a social URL using yt-dlp-exec.
 * yt-dlp-exec auto-downloads the yt-dlp binary — no Python needed.
 *
 * @param {string} url    - The social media URL
 * @param {string} format - 'video' | 'audio'
 * @returns {Promise<{ filePath: string, platform: string, title: string }>}
 */
async function downloadMedia(url, format = "video") {
  const id = crypto.randomBytes(8).toString("hex");
  const platform = detectPlatform(url);
  const outputTemplate = path.join(TEMP_DIR, `${id}.%(ext)s`);

  const baseOptions = {
    noPlaylist: true,
    noWarnings: true,
    output: outputTemplate,
    dumpSingleJson: false,
    printJson: true,
  };

  let options;
  if (format === "audio") {
    options = {
      ...baseOptions,
      extractAudio: true,
      audioFormat: "mp3",
      audioQuality: 0,
    };
  } else {
    options = {
      ...baseOptions,
      format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      mergeOutputFormat: "mp4",
    };
  }

  // Run yt-dlp — throws on failure
  let info;
  try {
    info = await ytDlp(url, options);
  } catch (err) {
    const msg = err.stderr || err.message || "yt-dlp failed";
    console.error("[Downloader] yt-dlp error:", msg);
    throw new Error(msg);
  }

  // yt-dlp replaces %(ext)s with the actual extension. Find the output file.
  const ext = format === "audio" ? "mp3" : (info?._filename?.split(".").pop() || "mp4");
  let filePath = path.join(TEMP_DIR, `${id}.${ext}`);

  // Fallback: scan temp dir for any file that starts with our unique id
  if (!fs.existsSync(filePath)) {
    const found = fs.readdirSync(TEMP_DIR).find(f => f.startsWith(id));
    if (found) {
      filePath = path.join(TEMP_DIR, found);
    } else {
      throw new Error("Downloaded file not found on disk after yt-dlp completed.");
    }
  }

  // Enforce 50 MB Telegram limit
  const { size } = fs.statSync(filePath);
  if (size > MAX_SIZE_BYTES) {
    fs.unlinkSync(filePath);
    const err = new Error("FILE_TOO_LARGE");
    err.code = "FILE_TOO_LARGE";
    err.url = url;
    throw err;
  }

  return {
    filePath,
    platform,
    title: info?.title || info?.fulltitle || "Media",
  };
}

/**
 * Silently delete a temp file.
 */
function cleanup(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

module.exports = { downloadMedia, detectPlatform, cleanup };
