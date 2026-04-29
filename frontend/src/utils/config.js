const BASE_URL = "https://uhc-backend.onrender.com";

export const getFileUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

export default BASE_URL;
