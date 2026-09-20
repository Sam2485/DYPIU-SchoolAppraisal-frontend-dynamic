import api from './client';

const getSessionSchool = () =>
  sessionStorage.getItem("userSchool") || localStorage.getItem("userSchool") || sessionStorage.getItem("school") || localStorage.getItem("school");

export const fetchActiveSchema = async (auditType = 'academic', school = null) => {
  try {
    const sch = school || getSessionSchool();
    const params = { auditType };
    if (sch) params.school = sch;
    const response = await api.get('/api/config/active', { params });
    return response.data;
  } catch (error) {
    console.warn('Failed to fetch active schema from backend, returning null for fallback:', error.message);
    return null;
  }
};

export const fetchSchemaByVersion = async (versionId) => {
  try {
    const response = await api.get(`/api/config/version/${versionId}`);
    return response.data;
  } catch (error) {
    console.warn(`Failed to fetch schema for version ${versionId}:`, error.message);
    return null;
  }
};

export const fetchUniversityBranding = async () => {
  try {
    const response = await api.get('/api/config/branding');
    return response.data;
  } catch (error) {
    console.warn('Failed to fetch branding:', error.message);
    return null;
  }
};

export const updateUniversityBranding = async (payload) => {
  const response = await api.put('/api/config/branding', payload);
  return response.data;
};

export const fetchUniversitiesDirectory = async () => {
  try {
    const response = await api.get('/api/config/branding');
    return response.data ? [response.data] : [];
  } catch (error) {
    return [];
  }
};

