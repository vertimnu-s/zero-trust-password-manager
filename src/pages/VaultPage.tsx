import { useEffect, useMemo, useState, useCallback } from "react";
import {
  fetchPasswords,
  savePassword,
  updatePassword,
  deletePassword,
} from "../services/api";
import { encryptPassword, decryptPassword, secureCopyToClipboard, secureWipeString, generateSecurePassword, sanitizeInput, validateSite, validateUsername, auditLogger } from "../services/crypto";

type ApiPasswordItem = {
  site: { S: string };
  username: { S: string };
  cipherText: { S: string };
  iv: { S: string };
  salt: { S: string };
  category?: { S: string };
  folder?: { S: string };
  favorite?: { BOOL?: boolean; S?: string };
  requireMasterPassword?: { BOOL?: boolean; S?: string };
};

type VaultItem = {
  id: string;
  site: string;
  username: string;
  cipherText: string;
  iv: string;
  salt: string;
  category: string;
  folder: string;
  favorite: boolean;
  requireMasterPassword: boolean;
};

type DynamoBoolean =
  | boolean
  | string
  | { BOOL?: boolean; S?: string }
  | null
  | undefined;

const categoryOptions = ["login", "card", "identity", "secure note"];

function normalizeBoolean(value: DynamoBoolean): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value === "true" || value === "1";
  }
  if (typeof value === "object") {
    if (value.BOOL !== undefined) return value.BOOL;
    if (value.S !== undefined) return value.S === "true";
  }
  return false;
}

function toVaultItem(item: ApiPasswordItem): VaultItem {
  const site = item.site?.S || "";
  const username = item.username?.S || "";
  const id = `${site}::${username}`;

  return {
    id,
    site,
    username,
    cipherText: item.cipherText?.S || "",
    iv: item.iv?.S || "",
    salt: item.salt?.S || "",
    category: item.category?.S || "login",
    folder: item.folder?.S || "",
    favorite: normalizeBoolean(item.favorite),
    requireMasterPassword: normalizeBoolean(item.requireMasterPassword),
  };
}

function VaultPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [masterPassword, setMasterPassword] = useState("");

  const [site, setSite] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [category, setCategory] = useState("login");
  const [folder, setFolder] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [requireMasterPassword, setRequireMasterPassword] = useState(true);

  const [lockDeadline, setLockDeadline] = useState<number | null>(null);
  const [timeToLock, setTimeToLock] = useState<number>(0);

  const lockVault = useCallback(() => {
    // Securely wipe decrypted passwords from memory
    Object.keys(decrypted).forEach(key => {
      secureWipeString(decrypted[key]);
    });
    setMasterPassword("");
    setDecrypted({});
    setShowPassword({});
    setLockDeadline(null);
    setTimeToLock(0);
    auditLogger.log({
      action: 'vault_lock',
      success: true,
      details: 'Vault locked and memory wiped'
    });
    console.info("Vault auto-locked.");
  }, [decrypted]);

  const [editId, setEditId] = useState<string | null>(null);
  const [originalItem, setOriginalItem] = useState<VaultItem | null>(null);

  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPassword, setModalPassword] = useState("");

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterFolder, setFilterFolder] = useState("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [generatorLength, setGeneratorLength] = useState(16);
  const [generatorIncludeSymbols, setGeneratorIncludeSymbols] = useState(true);
  const [generatorIncludeNumbers, setGeneratorIncludeNumbers] = useState(true);
  const [generatorIncludeLower, setGeneratorIncludeLower] = useState(true);
  const [generatorIncludeUpper, setGeneratorIncludeUpper] = useState(true);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const byCategory = filterCategory === "all" || item.category === filterCategory;
      const byFolder = filterFolder === "all" || item.folder === filterFolder;
      const byFavorite = !showFavoritesOnly || item.favorite;
      const bySearch = searchQuery === "" ||
        item.site.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.username.toLowerCase().includes(searchQuery.toLowerCase());
      return byCategory && byFolder && byFavorite && bySearch;
    });
  }, [items, filterCategory, filterFolder, showFavoritesOnly, searchQuery]);

  const uniqueFolders = useMemo(() => {
    const folders = items.map(item => item.folder).filter(f => f);
    return [...new Set(folders)];
  }, [items]);

  const loadPasswords = async () => {
    try {
      const data = (await fetchPasswords()) as ApiPasswordItem[];
      if (Array.isArray(data)) {
        const newItems = data.map(toVaultItem);
        return newItems;
      }
      return [];
    } catch (error) {
      console.error("Failed to load passwords", error);
      return [];
    }
  };

  useEffect(() => {
    let canceled = false;

    const init = async () => {
      const newItems = await loadPasswords();
      if (canceled) return;
      // Defer state update to avoid synchronous setState within effect semantics
      window.requestAnimationFrame(() => {
        if (!canceled) {
          setItems(newItems);
        }
      });
    };

    init();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!lockDeadline) {
      // lockDeadline update path itself already maintains timeToLock value.
      return;
    }

    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.floor((lockDeadline - Date.now()) / 1000));
      setTimeToLock(remaining);
      if (remaining <= 0) {
        lockVault();
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [lockDeadline, lockVault]);

  const requireMaster = () => {
    if (!masterPassword) {
      const promptValue = prompt("Enter master password to unlock (not saved)");
      if (!promptValue) {
        throw new Error("Master password is required");
      }

      // Master password is validated during registration, so we just accept it here
      setMasterPassword(promptValue);
      auditLogger.log({
        action: 'vault_unlock',
        success: true,
        details: 'Master password set'
      });
      return promptValue;
    }
    return masterPassword;
  };

  const handleLock = () => {
    lockVault();
    alert("Master key cleared from cache.");
  };

  const handleDecrypt = async (item: VaultItem) => {
    try {
      const passw = item.requireMasterPassword ? prompt("Item requires master password") || "" : requireMaster();
      if (!passw) {
        auditLogger.log({
          action: 'password_decrypt',
          site: item.site,
          username: item.username,
          success: false,
          details: 'Master password not provided'
        });
        alert("Master password required to decrypt");
        return;
      }

      const plain = await decryptPassword(item.cipherText, item.iv, item.salt, passw, item.site);
      setDecrypted((prev) => ({ ...prev, [item.id]: plain }));
      setShowPassword((prev) => ({ ...prev, [item.id]: true }));

      auditLogger.log({
        action: 'password_decrypt',
        site: item.site,
        username: item.username,
        success: true,
        details: 'Password decrypted successfully'
      });

      // Auto-hide decrypted password after 2 minutes for security
      setTimeout(() => {
        setShowPassword((prev) => ({ ...prev, [item.id]: false }));
        // Wipe from memory
        setDecrypted((prev) => {
          const copy = { ...prev };
          secureWipeString(copy[item.id]);
          delete copy[item.id];
          return copy;
        });
        auditLogger.log({
          action: 'password_decrypt',
          site: item.site,
          username: item.username,
          success: true,
          details: 'Decrypted password auto-wiped from memory'
        });
      }, 120000); // 2 minutes

    } catch (error) {
      auditLogger.log({
        action: 'password_decrypt',
        site: item.site,
        username: item.username,
        success: false,
        details: error instanceof Error ? error.message : String(error)
      });
      console.error("Decrypt failed", error);
      const message =
        error && typeof error === "object" && "message" in error
          ? (error as { message: string }).message
          : String(error);
      alert(`Decryption failed: ${message}`);
    }
  };

  const handleSave = async () => {
    try {
      // Sanitize and validate inputs
      const sanitizedSite = sanitizeInput(site.trim());
      const sanitizedUsername = sanitizeInput(username.trim());
      const sanitizedPassword = sanitizeInput(password.trim());
      const sanitizedFolder = sanitizeInput(folder.trim());

      if (!sanitizedSite || !sanitizedUsername || !sanitizedPassword) {
        alert("Site, username, and password are required");
        return;
      }

      if (!validateSite(sanitizedSite)) {
        alert("Invalid site format");
        return;
      }

      if (!validateUsername(sanitizedUsername)) {
        alert("Invalid username format (alphanumeric, dots, underscores, hyphens only)");
        return;
      }

      const passw = requireMaster();
      const encrypted = await encryptPassword(sanitizedPassword, passw, sanitizedSite);

      const newVaultItem: VaultItem = {
        id: `${sanitizedSite}::${sanitizedUsername}`,
        site: sanitizedSite,
        username: sanitizedUsername,
        cipherText: encrypted.cipherText,
        iv: encrypted.iv,
        salt: encrypted.salt,
        category,
        folder: sanitizedFolder,
        favorite,
        requireMasterPassword,
      };

      if (editId) {
        if (!originalItem) {
          alert("Original item not found for update");
          return;
        }
        await updatePassword(originalItem.site, originalItem.username, sanitizedSite, sanitizedUsername, encrypted.cipherText, encrypted.iv, encrypted.salt, category, sanitizedFolder, favorite, requireMasterPassword);
        const newId = `${sanitizedSite}::${sanitizedUsername}`;
        setItems((current) => current.map((i) => (i.id === editId ? { ...newVaultItem, id: newId } : i)));
        setEditId(null);
        setOriginalItem(null);
        auditLogger.log({
          action: 'password_update',
          site: sanitizedSite,
          username: sanitizedUsername,
          success: true,
          details: 'Password updated successfully'
        });
      } else {
        await savePassword(sanitizedSite, sanitizedUsername, encrypted.cipherText, encrypted.iv, encrypted.salt, category, sanitizedFolder, favorite, requireMasterPassword);
        setItems((current) => [...current, newVaultItem]);
        auditLogger.log({
          action: 'password_create',
          site: sanitizedSite,
          username: sanitizedUsername,
          success: true,
          details: 'Password created successfully'
        });
      }

      setSite("");
      setUsername("");
      setPassword("");
      setCategory("login");
      setFolder("");
      setFavorite(false);
      setRequireMasterPassword(true);
      setDecrypted({});
      setShowPassword({});

      alert(editId ? "Item updated" : "Item added");
    } catch (error) {
      auditLogger.log({
        action: editId ? 'password_update' : 'password_create',
        success: false,
        details: error instanceof Error ? error.message : String(error)
      });
      console.error("Save failed", error);
      alert("Could not save password item. See console.");
    }
  };

  const handleEdit = (item: VaultItem) => {
    setEditId(item.id);
    setOriginalItem(item);
    setSite(item.site);
    setUsername(item.username);
    setPassword(decrypted[item.id] || "");
    setCategory(item.category);
    setFolder(item.folder);
    setFavorite(item.favorite);
    setRequireMasterPassword(item.requireMasterPassword);
  };

  const openItemModal = (item: VaultItem) => {
    setSelectedItem(item);
    setModalPassword(decrypted[item.id] || "");
    setIsModalOpen(true);
  };

  const closeItemModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
    setModalPassword("");
  };

  const handleModalRevealPassword = async () => {
    if (!selectedItem) return;

    try {
      const passw = selectedItem.requireMasterPassword ? prompt("Enter master password to reveal") || "" : requireMaster();
      if (!passw) {
        alert("Master password required to reveal");
        return;
      }

      const plain = await decryptPassword(selectedItem.cipherText, selectedItem.iv, selectedItem.salt, passw, selectedItem.site);
      setModalPassword(plain);
      setDecrypted((prev) => ({ ...prev, [selectedItem.id]: plain }));
    } catch (error) {
      console.error("Reveal failed", error);
      const message =
        error && typeof error === "object" && "message" in error
          ? (error as { message: string }).message
          : String(error);
      alert(`Reveal failed: ${message}`);
    }
  };



  const handleDelete = async (item: VaultItem) => {
    if (!window.confirm(`Delete ${item.site} / ${item.username}?`)) return;
    try {
      await deletePassword(item.site, item.username);
      setItems((current) => current.filter((i) => i.id !== item.id));
      setDecrypted((current) => {
        const copy = { ...current };
        delete copy[item.id];
        return copy;
      });
      alert("Item deleted");
    } catch (error) {
      console.error("Delete failed", error);
      alert("Could not delete item. Check console.");
    }
  };

  const handleToggleFavorite = async (item: VaultItem) => {
    const updated = { ...item, favorite: !item.favorite };
    try {
      await updatePassword(item.site, item.username, item.site, item.username, item.cipherText, item.iv, item.salt, item.category, item.folder, updated.favorite, item.requireMasterPassword);
      setItems((current) => current.map((i) => (i.id === item.id ? updated : i)));
    } catch (error) {
      console.error("Favorite update failed", error);
      alert("Could not update favorite status.");
    }
  };

  const handleCopy = async (text: string, type: 'username' | 'password' = 'username') => {
    try {
      await secureCopyToClipboard(text, 30000); // Auto-clear after 30 seconds
      auditLogger.log({
        action: 'clipboard_copy',
        success: true,
        details: `${type} copied to clipboard`
      });
      alert(`${type === 'username' ? 'Username' : 'Password'} copied to clipboard (will auto-clear in 30 seconds)`);
    } catch (error) {
      auditLogger.log({
        action: 'clipboard_copy',
        success: false,
        details: error instanceof Error ? error.message : String(error)
      });
      alert("Failed to copy to clipboard");
    }
  };

  const generatePassword = () => {
    try {
      const generated = generateSecurePassword({
        length: generatorLength,
        includeLower: generatorIncludeLower,
        includeUpper: generatorIncludeUpper,
        includeNumbers: generatorIncludeNumbers,
        includeSymbols: generatorIncludeSymbols,
        avoidAmbiguous: true, // Avoid confusing characters
      });
      setPassword(generated);
      auditLogger.log({
        action: 'password_create',
        success: true,
        details: `Generated secure password of length ${generatorLength}`
      });
    } catch (error) {
      auditLogger.log({
        action: 'password_create',
        success: false,
        details: error instanceof Error ? error.message : String(error)
      });
      alert("Failed to generate password");
    }
  };

  return (
    <div style={{ padding: "40px" }}>
      <h2>Password Vault</h2>

      <div style={{ marginBottom: "16px" }}>
        <button
          onClick={() => {
            const master = requireMaster();
            setMasterPassword(master);
            setLockDeadline(Date.now() + 5 * 60 * 1000); // 5 min
          }}
        >
          Unlock Master Key
        </button>
        <button onClick={handleLock} style={{ marginLeft: "12px" }}>Lock Vault</button>
        <button
          onClick={() => {
            localStorage.removeItem("idToken");
            window.location.reload();
          }}
          style={{ marginLeft: "12px" }}
        >
          Logout
        </button>
        <span style={{ marginLeft: "14px", fontStyle: "italic" }}>
          {lockDeadline ? `Auto lock in ${timeToLock}s` : "Vault locked"}
        </span>
      </div>

      <div style={{ border: "1px solid #ddd", padding: "16px", marginBottom: "24px" }}>
        <h3>{editId ? "Edit Item" : "Add New Item"}</h3>
        <input type="text" value={site} onChange={(e) => setSite(e.target.value)} placeholder="Site (example.com)" style={{ width: "240px", marginRight: "8px" }} />
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" style={{ width: "240px", marginRight: "8px" }} />
        <br />
        <br />
        <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Plaintext password" style={{ width: "400px", marginRight: "8px" }} />
        <button onClick={generatePassword} style={{ marginRight: "8px" }}>Generate</button>
        <br />
        <br />
        <label style={{ marginRight: "8px" }}>
          Category:
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ marginLeft: "4px" }}>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </label>
        <label style={{ marginRight: "8px" }}>
          Folder:
          <input type="text" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Optional folder" style={{ marginLeft: "4px", width: "120px" }} />
        </label>
        <label style={{ marginRight: "8px" }}>
          <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} /> Favorite
        </label>
        <label>
          <input type="checkbox" checked={requireMasterPassword} onChange={(e) => setRequireMasterPassword(e.target.checked)} /> Require Master Password
        </label>
        <br />
        <br />
        <div style={{ marginBottom: "8px" }}>
          <strong>Generator options:</strong>
          <label style={{ marginLeft: "8px" }}><input type="checkbox" checked={generatorIncludeLower} onChange={(e) => setGeneratorIncludeLower(e.target.checked)} /> lower</label>
          <label style={{ marginLeft: "8px" }}><input type="checkbox" checked={generatorIncludeUpper} onChange={(e) => setGeneratorIncludeUpper(e.target.checked)} /> upper</label>
          <label style={{ marginLeft: "8px" }}><input type="checkbox" checked={generatorIncludeNumbers} onChange={(e) => setGeneratorIncludeNumbers(e.target.checked)} /> digits</label>
          <label style={{ marginLeft: "8px" }}><input type="checkbox" checked={generatorIncludeSymbols} onChange={(e) => setGeneratorIncludeSymbols(e.target.checked)} /> symbols</label>
          <label style={{ marginLeft: "8px" }}>length:
            <input type="number" value={generatorLength} min={8} max={64} onChange={(e) => setGeneratorLength(Number(e.target.value))} style={{ width: "58px", marginLeft: "4px" }} />
          </label>
        </div>

        <button onClick={handleSave}>{editId ? "Update Item" : "Save Item"}</button>
        {editId && <button onClick={() => { setEditId(null); setOriginalItem(null); setSite(""); setUsername(""); setPassword(""); setCategory("login"); setFolder(""); setFavorite(false); setRequireMasterPassword(true); }} style={{ marginLeft: "8px" }}>Cancel</button>}
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label>Search: </label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by site or username"
          style={{ marginRight: "12px", width: "200px" }}
        />
        <label>Filter category: </label>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ marginRight: "12px" }}>
          <option value="all">All</option>
          {categoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <label>Filter folder: </label>
        <select value={filterFolder} onChange={(e) => setFilterFolder(e.target.value)} style={{ marginRight: "12px" }}>
          <option value="all">All</option>
          {uniqueFolders.map((fold) => <option key={fold} value={fold}>{fold}</option>)}
        </select>
        <label><input type="checkbox" checked={showFavoritesOnly} onChange={(e) => setShowFavoritesOnly(e.target.checked)} /> Favorites only</label>
      </div>

      {filteredItems.length === 0 && <p>No items found.</p>}

      {filteredItems.map((item) => (
        <div key={item.id} style={{ border: "1px solid #ccc", padding: "12px", marginBottom: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <strong>{item.site}</strong> ({item.category})
              {item.folder && <span style={{ marginLeft: "8px", fontStyle: "italic" }}>📁 {item.folder}</span>}
              {item.favorite && <span style={{ marginLeft: "8px", color: "gold" }}>★</span>}
              {item.requireMasterPassword && <span style={{ marginLeft: "8px", color: "red" }}>[Master]</span>}
            </div>
            <div>
              <button onClick={() => handleToggleFavorite(item)}>{item.favorite ? "Unfavorite" : "Favorite"}</button>
              <button onClick={() => handleEdit(item)} style={{ marginLeft: "8px" }}>Edit</button>
              <button onClick={() => openItemModal(item)} style={{ marginLeft: "8px" }}>Details</button>
              <button onClick={() => handleDelete(item)} style={{ marginLeft: "8px" }}>Delete</button>
            </div>
          </div>

          <p><strong>Username:</strong> {item.username}</p>

          <div>
            <button onClick={() => handleDecrypt(item)}>Decrypt</button>
            <button onClick={() => setShowPassword((s) => ({ ...s, [item.id]: !s[item.id] }))} style={{ marginLeft: "8px" }}>
              {showPassword[item.id] ? "Hide" : "Show"}
            </button>
            <button onClick={() => handleCopy(item.username)} style={{ marginLeft: "8px" }}>Copy Username</button>
            {decrypted[item.id] && (
              <button onClick={() => handleCopy(decrypted[item.id], 'password')} style={{ marginLeft: "8px" }}>Copy Password</button>
            )}
          </div>

          {showPassword[item.id] && decrypted[item.id] && (
            <p><strong>Password:</strong> {decrypted[item.id]}</p>
          )}
        </div>
      ))}

      {isModalOpen && selectedItem && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={closeItemModal}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              width: "400px",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Details for {selectedItem.site}</h3>
            <p><strong>Username:</strong> {selectedItem.username}</p>
            <p><strong>Category:</strong> {selectedItem.category}</p>
            <p><strong>Folder:</strong> {selectedItem.folder || "None"}</p>
            <p><strong>Favorite:</strong> {selectedItem.favorite ? "Yes" : "No"}</p>
            <p><strong>Require master password on decrypt:</strong> {selectedItem.requireMasterPassword ? "Yes" : "No"}</p>
            <p><strong>Password:</strong> {modalPassword ? modalPassword : '••••••••'}</p>
            {!modalPassword && (
              <button onClick={handleModalRevealPassword} style={{ marginRight: "8px" }}>Reveal Password</button>
            )}
            <button onClick={() => { handleEdit(selectedItem); closeItemModal(); }} style={{ marginRight: "8px" }}>Edit</button>
            <button onClick={closeItemModal}>Close</button>
          </div>
        </div>
      )}

    </div>
  );
}

export default VaultPage;