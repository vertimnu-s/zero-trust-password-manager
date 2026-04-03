import { useEffect, useMemo, useState, useCallback } from "react";
import {
  fetchPasswords,
  savePassword,
  updatePassword,
  deletePassword,
} from "../services/api";
import { encryptPassword, decryptPassword, secureCopyToClipboard, secureWipeString, generateSecurePassword, sanitizeInput, validateSite, validateUsername, auditLogger } from "../services/crypto";
import { useToast } from "../components/ui/ToastContext";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { Search, Plus, Pencil, Trash2, Star, Eye, EyeOff, Copy, Lock, Unlock, FolderOpen, Shield, Wand2, X, Info, KeyRound } from "lucide-react";
import styles from "./VaultPage.module.css";

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
  const { addToast } = useToast();
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

  const [showMasterModal, setShowMasterModal] = useState(false);
  const [masterInput, setMasterInput] = useState("");
  const [masterResolve, setMasterResolve] = useState<((value: string) => void) | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

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

  const promptMasterPassword = (_message?: string): Promise<string> => {
    return new Promise((resolve) => {
      if (masterPassword) {
        resolve(masterPassword);
        return;
      }
      setMasterInput("");
      setShowMasterModal(true);
      setMasterResolve(() => resolve);
    });
  };

  const handleMasterSubmit = () => {
    if (!masterInput) return;
    setMasterPassword(masterInput);
    setLockDeadline(Date.now() + 5 * 60 * 1000);
    setShowMasterModal(false);
    auditLogger.log({ action: 'vault_unlock', success: true, details: 'Master password set' });
    if (masterResolve) masterResolve(masterInput);
    setMasterResolve(null);
    setMasterInput("");
  };

  const handleMasterCancel = () => {
    setShowMasterModal(false);
    if (masterResolve) masterResolve("");
    setMasterResolve(null);
    setMasterInput("");
  };

  const handleLock = () => {
    lockVault();
    addToast("Vault locked and keys cleared from memory", "info");
  };

  const handleDecrypt = async (item: VaultItem) => {
    try {
      let passw: string;
      if (item.requireMasterPassword) {
        passw = await promptMasterPassword("This item requires the master password");
      } else {
        if (!masterPassword) {
          passw = await promptMasterPassword();
        } else {
          passw = masterPassword;
        }
      }
      if (!passw) {
        auditLogger.log({ action: 'password_decrypt', site: item.site, username: item.username, success: false, details: 'Master password not provided' });
        return;
      }

      const plain = await decryptPassword(item.cipherText, item.iv, item.salt, passw, item.site);
      setDecrypted((prev) => ({ ...prev, [item.id]: plain }));
      setShowPassword((prev) => ({ ...prev, [item.id]: true }));

      auditLogger.log({ action: 'password_decrypt', site: item.site, username: item.username, success: true, details: 'Password decrypted successfully' });

      setTimeout(() => {
        setShowPassword((prev) => ({ ...prev, [item.id]: false }));
        setDecrypted((prev) => {
          const copy = { ...prev };
          secureWipeString(copy[item.id]);
          delete copy[item.id];
          return copy;
        });
        auditLogger.log({ action: 'password_decrypt', site: item.site, username: item.username, success: true, details: 'Decrypted password auto-wiped from memory' });
      }, 120000);

    } catch (error) {
      auditLogger.log({ action: 'password_decrypt', site: item.site, username: item.username, success: false, details: error instanceof Error ? error.message : String(error) });
      console.error("Decrypt failed", error);
      addToast("Decryption failed. Check your master password.", "error");
    }
  };

  const handleSave = async () => {
    try {
      const sanitizedSite = sanitizeInput(site.trim());
      const sanitizedUsername = sanitizeInput(username.trim());
      const sanitizedPassword = sanitizeInput(password.trim());
      const sanitizedFolder = sanitizeInput(folder.trim());

      if (!sanitizedSite || !sanitizedUsername || !sanitizedPassword) {
        addToast("Site, username, and password are required", "error");
        return;
      }

      if (!validateSite(sanitizedSite)) {
        addToast("Invalid site format", "error");
        return;
      }

      if (!validateUsername(sanitizedUsername)) {
        addToast("Invalid username format", "error");
        return;
      }

      let passw: string;
      if (!masterPassword) {
        passw = await promptMasterPassword();
        if (!passw) return;
      } else {
        passw = masterPassword;
      }

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
          addToast("Original item not found for update", "error");
          return;
        }
        await updatePassword(originalItem.site, originalItem.username, sanitizedSite, sanitizedUsername, encrypted.cipherText, encrypted.iv, encrypted.salt, category, sanitizedFolder, favorite, requireMasterPassword);
        const newId = `${sanitizedSite}::${sanitizedUsername}`;
        setItems((current) => current.map((i) => (i.id === editId ? { ...newVaultItem, id: newId } : i)));
        setEditId(null);
        setOriginalItem(null);
        auditLogger.log({ action: 'password_update', site: sanitizedSite, username: sanitizedUsername, success: true, details: 'Password updated successfully' });
        addToast("Item updated successfully", "success");
      } else {
        await savePassword(sanitizedSite, sanitizedUsername, encrypted.cipherText, encrypted.iv, encrypted.salt, category, sanitizedFolder, favorite, requireMasterPassword);
        setItems((current) => [...current, newVaultItem]);
        auditLogger.log({ action: 'password_create', site: sanitizedSite, username: sanitizedUsername, success: true, details: 'Password created successfully' });
        addToast("Item added to vault", "success");
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
      setShowAddForm(false);
    } catch (error) {
      auditLogger.log({ action: editId ? 'password_update' : 'password_create', success: false, details: error instanceof Error ? error.message : String(error) });
      console.error("Save failed", error);
      addToast("Could not save password item", "error");
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
    setShowAddForm(true);
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
      let passw: string;
      if (selectedItem.requireMasterPassword || !masterPassword) {
        passw = await promptMasterPassword();
      } else {
        passw = masterPassword;
      }
      if (!passw) return;

      const plain = await decryptPassword(selectedItem.cipherText, selectedItem.iv, selectedItem.salt, passw, selectedItem.site);
      setModalPassword(plain);
      setDecrypted((prev) => ({ ...prev, [selectedItem.id]: plain }));
    } catch (error) {
      console.error("Reveal failed", error);
      addToast("Failed to reveal password", "error");
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
      addToast("Item deleted", "success");
    } catch (error) {
      console.error("Delete failed", error);
      addToast("Could not delete item", "error");
    }
  };

  const handleToggleFavorite = async (item: VaultItem) => {
    const updated = { ...item, favorite: !item.favorite };
    try {
      await updatePassword(item.site, item.username, item.site, item.username, item.cipherText, item.iv, item.salt, item.category, item.folder, updated.favorite, item.requireMasterPassword);
      setItems((current) => current.map((i) => (i.id === item.id ? updated : i)));
    } catch (error) {
      console.error("Favorite update failed", error);
      addToast("Could not update favorite status", "error");
    }
  };

  const handleCopy = async (text: string, type: 'username' | 'password' = 'username') => {
    try {
      await secureCopyToClipboard(text, 30000);
      auditLogger.log({ action: 'clipboard_copy', success: true, details: `${type} copied to clipboard` });
      addToast(`${type === 'username' ? 'Username' : 'Password'} copied (auto-clears in 30s)`, "success");
    } catch (error) {
      auditLogger.log({ action: 'clipboard_copy', success: false, details: error instanceof Error ? error.message : String(error) });
      addToast("Failed to copy to clipboard", "error");
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
        avoidAmbiguous: true,
      });
      setPassword(generated);
      auditLogger.log({ action: 'password_create', success: true, details: `Generated secure password of length ${generatorLength}` });
    } catch (error) {
      auditLogger.log({ action: 'password_create', success: false, details: error instanceof Error ? error.message : String(error) });
      addToast("Failed to generate password", "error");
    }
  };

  const cancelEdit = () => {
    setEditId(null);
    setOriginalItem(null);
    setSite("");
    setUsername("");
    setPassword("");
    setCategory("login");
    setFolder("");
    setFavorite(false);
    setRequireMasterPassword(true);
    setShowAddForm(false);
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Vault</h1>
          <div className={styles.lockStatus}>
            {lockDeadline ? (
              <>
                <Unlock size={14} />
                <span className={styles.lockTimer}>Auto-lock in {timeToLock}s</span>
              </>
            ) : (
              <>
                <Lock size={14} />
                <span>Locked</span>
              </>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          {lockDeadline ? (
            <Button variant="ghost" size="sm" icon={<Lock size={16} />} onClick={handleLock}>
              Lock
            </Button>
          ) : (
            <Button variant="ghost" size="sm" icon={<Unlock size={16} />} onClick={() => promptMasterPassword()}>
              Unlock
            </Button>
          )}
          <Button
            icon={<Plus size={16} />}
            size="sm"
            onClick={() => { cancelEdit(); setShowAddForm(true); }}
          >
            Add Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Input
            placeholder="Search vault..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search size={16} />}
          />
        </div>
        <div className={styles.filterGroup}>
          <div className={styles.selectWrapper}>
            <span className={styles.selectLabel}>Category</span>
            <select className={styles.select} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">All</option>
              {categoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className={styles.selectWrapper}>
            <span className={styles.selectLabel}>Folder</span>
            <select className={styles.select} value={filterFolder} onChange={(e) => setFilterFolder(e.target.value)}>
              <option value="all">All</option>
              {uniqueFolders.map((fold) => <option key={fold} value={fold}>{fold}</option>)}
            </select>
          </div>
          <button
            className={`${styles.favToggle} ${showFavoritesOnly ? styles.favToggleActive : ''}`}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          >
            <Star size={14} fill={showFavoritesOnly ? 'currentColor' : 'none'} />
            Favorites
          </button>
        </div>
      </div>

      {/* Add / Edit Form */}
      {showAddForm && (
        <Card className={styles.formCard}>
          <h3 className={styles.formTitle}>
            {editId ? <><Pencil size={18} /> Edit Item</> : <><Plus size={18} /> New Item</>}
          </h3>
          <div className={styles.formGrid}>
            <Input label="Site" value={site} onChange={(e) => setSite(e.target.value)} placeholder="example.com" />
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="user@example.com" />
            <div className={`${styles.formFullRow} ${styles.passwordInputRow}`}>
              <Input label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter or generate a password" />
              <Button variant="secondary" icon={<Wand2 size={16} />} onClick={generatePassword}>Generate</Button>
            </div>
            <div className={styles.selectWrapper}>
              <span className={styles.selectLabel}>Category</span>
              <select className={styles.select} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <Input label="Folder" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Optional folder" />
            <div className={`${styles.formFullRow} ${styles.formOptions}`}>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
                Favorite
              </label>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={requireMasterPassword} onChange={(e) => setRequireMasterPassword(e.target.checked)} />
                Require Master Password
              </label>
            </div>
          </div>

          {/* Generator options */}
          <div className={styles.generatorSection}>
            <div className={styles.generatorTitle}><Wand2 size={14} /> Generator Options</div>
            <div className={styles.generatorOptions}>
              <label className={styles.checkbox}><input type="checkbox" checked={generatorIncludeLower} onChange={(e) => setGeneratorIncludeLower(e.target.checked)} /> a-z</label>
              <label className={styles.checkbox}><input type="checkbox" checked={generatorIncludeUpper} onChange={(e) => setGeneratorIncludeUpper(e.target.checked)} /> A-Z</label>
              <label className={styles.checkbox}><input type="checkbox" checked={generatorIncludeNumbers} onChange={(e) => setGeneratorIncludeNumbers(e.target.checked)} /> 0-9</label>
              <label className={styles.checkbox}><input type="checkbox" checked={generatorIncludeSymbols} onChange={(e) => setGeneratorIncludeSymbols(e.target.checked)} /> !@#</label>
              <label className={styles.checkbox}>
                Length
                <input type="number" value={generatorLength} min={8} max={64} onChange={(e) => setGeneratorLength(Number(e.target.value))} className={styles.lengthInput} />
              </label>
            </div>
          </div>

          <div className={styles.formActions}>
            <Button onClick={handleSave}>{editId ? "Update Item" : "Save Item"}</Button>
            <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Vault Items */}
      {filteredItems.length === 0 ? (
        <div className={styles.emptyState}>
          <KeyRound size={48} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No items found</p>
          <p className={styles.emptyText}>
            {items.length === 0 ? "Add your first password to get started" : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className={styles.itemList}>
          {filteredItems.map((item) => (
            <div key={item.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemSite}>{item.site}</span>
                  <span className={styles.itemBadge}>{item.category}</span>
                  {item.folder && (
                    <span className={styles.itemFolder}>
                      <FolderOpen size={12} /> {item.folder}
                    </span>
                  )}
                  {item.favorite && <Star size={14} className={styles.itemFav} fill="currentColor" />}
                  {item.requireMasterPassword && (
                    <span className={styles.itemMaster}><Shield size={12} /> Master</span>
                  )}
                </div>
                <div className={styles.itemActions}>
                  <Button variant="ghost" size="sm" icon={<Star size={14} fill={item.favorite ? "currentColor" : "none"} />} onClick={() => handleToggleFavorite(item)} />
                  <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => handleEdit(item)} />
                  <Button variant="ghost" size="sm" icon={<Info size={14} />} onClick={() => openItemModal(item)} />
                  <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => handleDelete(item)} />
                </div>
              </div>
              <div className={styles.itemBody}>
                <span className={styles.itemUsername}>{item.username}</span>
                <div className={styles.itemPasswordActions}>
                  <Button variant="ghost" size="sm" icon={<Copy size={14} />} onClick={() => handleCopy(item.username)}>Username</Button>
                  {decrypted[item.id] ? (
                    <>
                      <Button variant="ghost" size="sm" icon={showPassword[item.id] ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => setShowPassword((s) => ({ ...s, [item.id]: !s[item.id] }))}>
                        {showPassword[item.id] ? "Hide" : "Show"}
                      </Button>
                      <Button variant="ghost" size="sm" icon={<Copy size={14} />} onClick={() => handleCopy(decrypted[item.id], 'password')}>Password</Button>
                    </>
                  ) : (
                    <Button variant="secondary" size="sm" icon={<Unlock size={14} />} onClick={() => handleDecrypt(item)}>Decrypt</Button>
                  )}
                </div>
              </div>
              {showPassword[item.id] && decrypted[item.id] && (
                <div className={styles.revealedPassword}>{decrypted[item.id]}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {isModalOpen && selectedItem && (
        <div className={styles.modalOverlay} onClick={closeItemModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{selectedItem.site}</h3>
              <button className={styles.closeButton} onClick={closeItemModal}><X size={18} /></button>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Username</span>
              <span className={styles.detailValue}>{selectedItem.username}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Category</span>
              <span className={styles.detailValue}>{selectedItem.category}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Folder</span>
              <span className={styles.detailValue}>{selectedItem.folder || "None"}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Favorite</span>
              <span className={styles.detailValue}>{selectedItem.favorite ? "Yes" : "No"}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Master Required</span>
              <span className={styles.detailValue}>{selectedItem.requireMasterPassword ? "Yes" : "No"}</span>
            </div>
            <div className={styles.modalPasswordRow}>
              <div className={styles.modalPasswordLabel}>Password</div>
              <div className={styles.modalPasswordValue}>{modalPassword || '••••••••'}</div>
            </div>
            <div className={styles.modalActions}>
              {!modalPassword && <Button variant="secondary" size="sm" icon={<Eye size={14} />} onClick={handleModalRevealPassword}>Reveal</Button>}
              <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => { handleEdit(selectedItem); closeItemModal(); }}>Edit</Button>
              <Button variant="ghost" size="sm" onClick={closeItemModal}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Master Password Modal */}
      {showMasterModal && (
        <div className={styles.masterOverlay} onClick={handleMasterCancel}>
          <div className={styles.masterModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.masterTitle}>Unlock Vault</h3>
            <p className={styles.masterSubtitle}>Enter your master password to continue</p>
            <Input
              type="password"
              value={masterInput}
              onChange={(e) => setMasterInput(e.target.value)}
              placeholder="Master password"
              icon={<Lock size={18} />}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleMasterSubmit()}
            />
            <div className={styles.masterActions}>
              <Button onClick={handleMasterSubmit} fullWidth>Unlock</Button>
              <Button variant="ghost" onClick={handleMasterCancel} fullWidth>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VaultPage;