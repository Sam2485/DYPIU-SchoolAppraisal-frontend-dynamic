import apiClient from "./client";

export const fetchUsers = ({ includeDeleted = false } = {}) =>
  apiClient.get("/api/users", { params: includeDeleted ? { includeDeleted: true } : undefined });

export const createUser = (payload) => apiClient.post("/api/users", payload);

export const updateUser = (userId, payload) => apiClient.put(`/api/users/${encodeURIComponent(userId)}`, payload);

export const deleteUser = (userId) => apiClient.delete(`/api/users/${encodeURIComponent(userId)}`);

export const fetchCurrentUser = () => apiClient.get("/api/users/me");

export const updateCurrentUser = (payload) => apiClient.put("/api/users/me", payload);

export const uploadCurrentUserAvatar = async (file) => {
  let avatarUrl = "";

  // 1. Upload to centralized storage-service via /api/attachments/upload
  // This guarantees physical file persistence in the shared uploads volume.
  try {
    const formData = new FormData();
    formData.append("file", file);
    const { data: storageData } = await apiClient.post("/api/attachments/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const uploaded = storageData?.data || storageData || {};
    avatarUrl = uploaded.url || uploaded.downloadUrl || uploaded.publicUrl || "";
  } catch (storageErr) {
    console.warn("Storage service upload failed, attempting fallback directly to auth service...", storageErr);
  }

  // 2. Persist avatarUrl to auth-user-service
  if (avatarUrl) {
    const { data } = await apiClient.post("/api/users/me/avatar", { avatarUrl });
    const saved = data?.data || data || {};
    return saved.avatarUrl || avatarUrl;
  }

  // Fallback: upload multipart directly to auth-user-service
  const authFormData = new FormData();
  authFormData.append("avatar", file);
  const { data } = await apiClient.post("/api/users/me/avatar", authFormData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const uploaded = data?.data || data || {};
  return uploaded.avatarUrl || uploaded.url || "";
};

export const removeCurrentUserAvatar = () => apiClient.delete("/api/users/me/avatar");

export const changeCurrentUserPassword = (payload) => apiClient.put("/api/users/me/password", payload);
