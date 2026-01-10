/**
 * CredentialSelector Component
 *
 * A dropdown selector for choosing stored credentials.
 * Used within ModuleConfigPanel for credential-type fields.
 */

import { useState } from 'react';
import { Key, Plus, AlertCircle } from 'lucide-react';
import { useCredentials, useCredentialsByType } from '../../context/CredentialContext';
import type { CredentialType } from '../../data/modules';
import { CREDENTIAL_TYPE_METADATA } from '../../../../shared/schemas/module-configs';

interface CredentialSelectorProps {
  type: CredentialType;
  value: string | undefined;
  onChange: (credentialId: string | undefined) => void;
  label?: string;
  required?: boolean;
  onAddNew?: () => void;
}

export function CredentialSelector({
  type,
  value,
  onChange,
  label,
  required = false,
  onAddNew,
}: CredentialSelectorProps) {
  const { isUnlocked } = useCredentials();
  const credentials = useCredentialsByType(type);
  const metadata = CREDENTIAL_TYPE_METADATA[type];

  if (!isUnlocked) {
    return (
      <div className="credential-selector locked">
        <label className="field-label">
          <Key size={14} />
          {label || metadata?.label || 'Credential'}
          {required && <span className="required">*</span>}
        </label>
        <div className="locked-message">
          <AlertCircle size={14} />
          <span>Unlock credential store to select</span>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="credential-selector">
      <label className="field-label">
        <Key size={14} />
        {label || metadata?.label || 'Credential'}
        {required && <span className="required">*</span>}
      </label>

      <div className="selector-row">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={`credential-select ${!value && required ? 'invalid' : ''}`}
        >
          <option value="">
            {credentials.length === 0
              ? `No ${metadata?.label || type} credentials`
              : 'Select credential...'}
          </option>
          {credentials.map((cred) => (
            <option key={cred.id} value={cred.id}>
              {cred.name}
              {cred.description ? ` - ${cred.description}` : ''}
            </option>
          ))}
        </select>

        {onAddNew && (
          <button
            type="button"
            className="add-button"
            onClick={onAddNew}
            title="Add new credential"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {metadata?.description && (
        <span className="field-description">{metadata.description}</span>
      )}

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .credential-selector {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }

  .credential-selector .field-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #00ff41;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .credential-selector .required {
    color: #ff6b6b;
  }

  .credential-selector .selector-row {
    display: flex;
    gap: 8px;
  }

  .credential-selector .credential-select {
    flex: 1;
    padding: 10px 12px;
    background: rgba(0, 255, 65, 0.05);
    border: 1px solid rgba(0, 255, 65, 0.3);
    border-radius: 4px;
    color: #e0e0e0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .credential-selector .credential-select:hover {
    border-color: rgba(0, 255, 65, 0.5);
    background: rgba(0, 255, 65, 0.08);
  }

  .credential-selector .credential-select:focus {
    outline: none;
    border-color: #00ff41;
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.3);
  }

  .credential-selector .credential-select.invalid {
    border-color: rgba(255, 107, 107, 0.5);
    background: rgba(255, 107, 107, 0.05);
  }

  .credential-selector .credential-select option {
    background: #1a1a2e;
    color: #e0e0e0;
  }

  .credential-selector .add-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    background: rgba(0, 255, 65, 0.1);
    border: 1px solid rgba(0, 255, 65, 0.3);
    border-radius: 4px;
    color: #00ff41;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .credential-selector .add-button:hover {
    background: rgba(0, 255, 65, 0.2);
    border-color: #00ff41;
  }

  .credential-selector .field-description {
    font-size: 11px;
    color: #888;
    font-style: italic;
  }

  .credential-selector.locked .locked-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.3);
    border-radius: 4px;
    color: #ff6b6b;
    font-size: 12px;
  }
`;

/**
 * AddCredentialDialog Component
 *
 * Modal dialog for adding a new credential.
 */

interface AddCredentialDialogProps {
  type: CredentialType;
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, values: Record<string, string>, description?: string) => Promise<void>;
}

export function AddCredentialDialog({
  type,
  isOpen,
  onClose,
  onSave,
}: AddCredentialDialogProps) {
  const metadata = CREDENTIAL_TYPE_METADATA[type];
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    const missingFields = metadata?.fields
      .filter((f) => f.required && !values[f.name])
      .map((f) => f.label);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (missingFields && missingFields.length > 0) {
      setError(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      await onSave(name.trim(), values, description.trim() || undefined);
      // Reset form
      setName('');
      setDescription('');
      setValues({});
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="dialog-title">
          <Key size={18} />
          Add {metadata?.label || type} Credential
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My API Key"
              autoFocus
            />
          </div>

          <div className="form-field">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {metadata?.fields.map((field) => (
            <div key={field.name} className="form-field">
              <label>
                {field.label}
                {field.required && ' *'}
              </label>
              <input
                type={field.type}
                value={values[field.name] || ''}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                }
                placeholder={field.label}
              />
            </div>
          ))}

          {error && <div className="error-message">{error}</div>}

          <div className="dialog-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>

        <style>{dialogStyles}</style>
      </div>
    </div>
  );
}

const dialogStyles = `
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog-content {
    background: #1a1a2e;
    border: 1px solid rgba(0, 255, 65, 0.3);
    border-radius: 8px;
    padding: 24px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 0 30px rgba(0, 255, 65, 0.2);
  }

  .dialog-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 20px 0;
    color: #00ff41;
    font-size: 16px;
    font-weight: 600;
  }

  .dialog-content .form-field {
    margin-bottom: 16px;
  }

  .dialog-content .form-field label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #888;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .dialog-content .form-field input {
    width: 100%;
    padding: 10px 12px;
    background: rgba(0, 255, 65, 0.05);
    border: 1px solid rgba(0, 255, 65, 0.3);
    border-radius: 4px;
    color: #e0e0e0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    box-sizing: border-box;
  }

  .dialog-content .form-field input:focus {
    outline: none;
    border-color: #00ff41;
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.3);
  }

  .dialog-content .error-message {
    padding: 10px;
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.3);
    border-radius: 4px;
    color: #ff6b6b;
    font-size: 12px;
    margin-bottom: 16px;
  }

  .dialog-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 24px;
  }

  .dialog-actions button {
    padding: 10px 20px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .dialog-actions .btn-cancel {
    background: transparent;
    border: 1px solid rgba(136, 136, 136, 0.5);
    color: #888;
  }

  .dialog-actions .btn-cancel:hover {
    border-color: #888;
    color: #e0e0e0;
  }

  .dialog-actions .btn-save {
    background: rgba(0, 255, 65, 0.2);
    border: 1px solid #00ff41;
    color: #00ff41;
  }

  .dialog-actions .btn-save:hover {
    background: rgba(0, 255, 65, 0.3);
  }

  .dialog-actions .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
