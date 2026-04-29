const BASE_URL = "http://localhost:5000";

export const getFileUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

export default BASE_URL;
