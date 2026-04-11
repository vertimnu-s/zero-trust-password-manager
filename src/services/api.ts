const API_URL = import.meta.env.VITE_API_URL;

async function handleResponse(response: Response) {
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json();
}

function getAuthHeaders() {
  const token = localStorage.getItem("idToken");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

const routePaths = {
  create: `${API_URL}/createPasswordItem`,
  read: `${API_URL}/getPasswordItems`,
  update: `${API_URL}/updatePasswordItem`,
  delete: `${API_URL}/deletePasswordItem`,
};

export const savePassword = async (
  site: string,
  username: string,
  cipherText: string,
  iv: string,
  salt: string,
  category = "login",
  folder = "",
  favorite = false,
  requireMasterPassword = false
) => {
  const response = await fetch(routePaths.create, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      site,
      username,
      cipherText,
      iv,
      salt,
      category,
      folder,
      favorite,
      requireMasterPassword,
    }),
  });

  return handleResponse(response);
};

export const fetchPasswords = async () => {
  try {
    const response = await fetch(routePaths.read, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (response.status === 404) {
      // No saved passwords yet
      return [];
    }

    return handleResponse(response);
  } catch {
    return [];
  }
};

export const updatePassword = async (
  oldSite: string,
  oldUsername: string,
  newSite: string,
  newUsername: string,
  cipherText: string,
  iv: string,
  salt: string,
  category = "login",
  folder = "",
  favorite = false,
  requireMasterPassword = false
) => {
  const oldItemKey = `${oldSite}#${oldUsername}`;
  const newItemKey = `${newSite}#${newUsername}`;

  const response = await fetch(routePaths.update, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      oldItemKey,
      itemKey: newItemKey,
      site: newSite,
      username: newUsername,
      cipherText,
      iv,
      salt,
      category,
      folder,
      favorite,
      requireMasterPassword,
    }),
  });

  return handleResponse(response);
};

export const deletePassword = async (site: string, username: string) => {
  const response = await fetch(
    `${routePaths.delete}?site=${encodeURIComponent(site)}&username=${encodeURIComponent(username)}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );

  return handleResponse(response);
};

function handleUnauthorized() {
  localStorage.removeItem("idToken");
  localStorage.removeItem("refreshToken");
  window.location.reload();
}
