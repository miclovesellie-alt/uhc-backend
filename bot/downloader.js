const ytDlp = require("yt-dlp-exec");
const { alldl } = require("rahad-all-downloader-v2");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const TEMP_DIR = path.join(__dirname, "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const MAX_SIZE_BYTES = 49 * 1024 * 1024; // 49 MB limit for Telegram bot upload

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
 * Downloads a direct media stream URL to a local file path using Axios
 */
async function downloadDirectStream(mediaUrl, destPath) {
  const writer = fs.createWriteStream(destPath);
  const response = await axios({
    url: mediaUrl,
    method: "GET",
    responseType: "stream",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    timeout: 60000,
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

/**
 * Main Download Function (Dual Engine: yt-dlp-exec primary + JS API fallback)
 */
async function downloadMedia(url, format = "video") {
  const id = crypto.randomBytes(8).toString("hex");
  const platform = detectPlatform(url);
  const ext = format === "audio" ? "mp3" : "mp4";
  const outputTemplate = path.join(TEMP_DIR, `${id}.%(ext)s`);
  const finalFilePath = path.join(TEMP_DIR, `${id}.${ext}`);

  // ── Engine 1: yt-dlp-exec ──────────────────────────────────────────────
  try {
    console.log(`[Downloader] Attempting yt-dlp engine for ${url}...`);
    const options = {
      noPlaylist: true,
      noWarnings: true,
      output: outputTemplate,
    };
    if (format === "audio") {
      options.extractAudio = true;
      options.audioFormat = "mp3";
      options.audioQuality = 0;
    } else {
      options.format = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best";
      options.mergeOutputFormat = "mp4";
    }

    const info = await ytDlp(url, options);

    let filePath = finalFilePath;
    if (!fs.existsSync(filePath)) {
      const found = fs.readdirSync(TEMP_DIR).find(f => f.startsWith(id));
      if (found) filePath = path.join(TEMP_DIR, found);
    }

    if (fs.existsSync(filePath)) {
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
        title: info?.title || info?.fulltitle || "Media Content",
      };
    }
  } catch (ytErr) {
    if (ytErr.code === "FILE_TOO_LARGE") throw ytErr;
    console.warn(`[Downloader] Engine 1 (yt-dlp) error/fallback: ${ytErr.message}`);
  }

  // ── Engine 2: Pure JS API Fallback (rahad-all-downloader-v2) ───────────
  try {
    console.log(`[Downloader] Attempting JS API engine fallback for ${url}...`);
    const data = await alldl(url);

    let mediaUrl = null;
    let title = data?.title || data?.caption || `${platform} Media`;

    if (data?.video || data?.low || data?.high || data?.result || data?.url) {
      mediaUrl = data.video || data.high || data.low || data.result || data.url;
      if (Array.isArray(mediaUrl)) mediaUrl = mediaUrl[0];
    } else if (data?.data) {
      const d = data.data;
      mediaUrl = d.video || d.url || (Array.isArray(d) ? d[0]?.url || d[0] : null);
    }

    if (!mediaUrl && typeof data === "string" && data.startsWith("http")) {
      mediaUrl = data;
    }

    if (!mediaUrl) {
      throw new Error(`Extraction fallback returned no direct media link`);
    }

    console.log(`[Downloader] Streaming media from ${mediaUrl.slice(0, 60)}...`);
    await downloadDirectStream(mediaUrl, finalFilePath);

    if (!fs.existsSync(finalFilePath)) {
      throw new Error("Downloaded file failed to write to disk.");
    }

    const { size } = fs.statSync(finalFilePath);
    if (size > MAX_SIZE_BYTES) {
      fs.unlinkSync(finalFilePath);
      const err = new Error("FILE_TOO_LARGE");
      err.code = "FILE_TOO_LARGE";
      err.url = url;
      throw err;
    }

    return {
      filePath: finalFilePath,
      platform,
      title,
    };
  } catch (fallbackErr) {
    if (fallbackErr.code === "FILE_TOO_LARGE") throw fallbackErr;
    console.error("[Downloader] Engine 2 fallback failed:", fallbackErr.message);
    throw new Error(`Could not download media from ${platform}. Please ensure the link is public.`);
  }
}

function cleanup(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

module.exports = { downloadMedia, detectPlatform, cleanup };
