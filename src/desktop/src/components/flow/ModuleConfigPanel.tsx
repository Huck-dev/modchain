/**
 * ModuleConfigPanel Component
 *
 * Dynamic configuration form for module nodes in the Flow Builder.
 * Renders form fields based on module-specific schemas.
 */

import { useState, useCallback, useMemo } from 'react';
import { Settings, Save, AlertTriangle, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { CredentialSelector, AddCredentialDialog } from './CredentialSelector';
import { useCredentials } from '../../context/CredentialContext';
import { getModuleById, type ModuleDefinition } from '../../data/modules';
import {
  getModuleFormFields,
  validateModuleConfig,
  type ConfigFormField,
} from '../../../../shared/schemas/module-configs';

interface ModuleConfigPanelProps {
  moduleId: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  onClose?: () => void;
}

export function ModuleConfigPanel({
  moduleId,
  config,
  onChange,
  onClose,
}: ModuleConfigPanelProps) {
  const module = getModuleById(moduleId);
  const formFields = getModuleFormFields(moduleId);
  const { addCredential, isUnlocked } = useCredentials();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));
  const [addCredentialType, setAddCredentialType] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Validate configuration
  const validation = useMemo(() => {
    return validateModuleConfig(moduleId, config);
  }, [moduleId, config]);

  // Get nested value from config
  const getValue = useCallback(
    (path: string): unknown => {
      const parts = path.split('.');
      let value: unknown = config;
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = (value as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }
      return value;
    },
    [config]
  );

  // Set nested value in config
  const setValue = useCallback(
    (path: string, value: unknown) => {
      const parts = path.split('.');
      const newConfig = JSON.parse(JSON.stringify(config));

      let current = newConfig;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current) || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part];
      }
      current[parts[parts.length - 1]] = value;

      onChange(newConfig);
    },
    [config, onChange]
  );

  // Check if field should be visible
  const isFieldVisible = useCallback(
    (field: ConfigFormField): boolean => {
      if (!field.showIf) return true;
      const fieldValue = getValue(field.showIf.field);
      return fieldValue === field.showIf.value;
    },
    [getValue]
  );

  // Render form field
  const renderField = useCallback(
    (field: ConfigFormField) => {
      if (!isFieldVisible(field)) return null;

      const value = getValue(field.name);
      const error = validationErrors[field.name];

      switch (field.type) {
        case 'text':
        case 'password':
          return (
            <div key={field.name} className="form-field">
              <label>
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              <input
                type={field.type}
                value={(value as string) || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                placeholder={field.placeholder}
              />
              {field.description && <span className="description">{field.description}</span>}
              {error && <span className="error">{error}</span>}
            </div>
          );

        case 'number':
          return (
            <div key={field.name} className="form-field">
              <label>
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              <input
                type="number"
                value={(value as number) ?? field.default ?? ''}
                onChange={(e) =>
                  setValue(field.name, e.target.value ? parseFloat(e.target.value) : undefined)
                }
                min={field.min}
                max={field.max}
                step={field.step}
                placeholder={field.placeholder}
              />
              {field.description && <span className="description">{field.description}</span>}
              {error && <span className="error">{error}</span>}
            </div>
          );

        case 'boolean':
          return (
            <div key={field.name} className="form-field checkbox-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={(value as boolean) ?? (field.default as boolean) ?? false}
                  onChange={(e) => setValue(field.name, e.target.checked)}
                />
                <span className="checkbox-text">{field.label}</span>
              </label>
              {field.description && <span className="description">{field.description}</span>}
            </div>
          );

        case 'select':
          return (
            <div key={field.name} className="form-field">
              <label>
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              <select
                value={(value as string) || (field.default as string) || ''}
                onChange={(e) => setValue(field.name, e.target.value || undefined)}
              >
                <option value="">Select...</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {field.description && <span className="description">{field.description}</span>}
              {error && <span className="error">{error}</span>}
            </div>
          );

        case 'multiselect':
          return (
            <div key={field.name} className="form-field">
              <label>
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              <div className="multiselect">
                {field.options?.map((opt) => {
                  const selected = Array.isArray(value) && value.includes(opt.value);
                  return (
                    <label key={opt.value} className="multiselect-option">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const currentValues = Array.isArray(value) ? value : [];
                          if (e.target.checked) {
                            setValue(field.name, [...currentValues, opt.value]);
                          } else {
                            setValue(
                              field.name,
                              currentValues.filter((v: string) => v !== opt.value)
                            );
                          }
                        }}
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
              {field.description && <span className="description">{field.description}</span>}
            </div>
          );

        case 'textarea':
          return (
            <div key={field.name} className="form-field">
              <label>
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              <textarea
                value={(value as string) || ''}
                onChange={(e) => setValue(field.name, e.target.value)}
                placeholder={field.placeholder}
                rows={4}
              />
              {field.description && <span className="description">{field.description}</span>}
              {error && <span className="error">{error}</span>}
            </div>
          );

        case 'credential':
          return (
            <CredentialSelector
              key={field.name}
              type={field.credentialType || 'custom'}
              value={(value as { credentialId: string })?.credentialId}
              onChange={(credentialId) =>
                setValue(field.name, credentialId ? { credentialId, type: field.credentialType } : undefined)
              }
              label={field.label}
              required={field.required}
              onAddNew={() => setAddCredentialType(field.credentialType || 'custom')}
            />
          );

        case 'json':
          return (
            <div key={field.name} className="form-field">
              <label>
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              <textarea
                value={
                  typeof value === 'string'
                    ? value
                    : value
                    ? JSON.stringify(value, null, 2)
                    : ''
                }
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setValue(field.name, parsed);
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next[field.name];
                      return next;
                    });
                  } catch {
                    // Store as string temporarily
                    setValue(field.name, e.target.value);
                    setValidationErrors((prev) => ({
                      ...prev,
                      [field.name]: 'Invalid JSON',
                    }));
                  }
                }}
                placeholder={field.placeholder || '{}'}
                rows={6}
                className="json-input"
              />
              {field.description && <span className="description">{field.description}</span>}
              {error && <span className="error">{error}</span>}
            </div>
          );

        case 'array':
          const arrayValue = Array.isArray(value) ? value : [];
          return (
            <div key={field.name} className="form-field">
              <label>
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              <div className="array-field">
                {arrayValue.map((item, index) => (
                  <div key={index} className="array-item">
                    <input
                      type="text"
                      value={item as string}
                      onChange={(e) => {
                        const newArray = [...arrayValue];
                        newArray[index] = e.target.value;
                        setValue(field.name, newArray);
                      }}
                    />
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => {
                        const newArray = arrayValue.filter((_, i) => i !== index);
                        setValue(field.name, newArray);
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="add-btn"
                  onClick={() => setValue(field.name, [...arrayValue, ''])}
                >
                  + Add Item
                </button>
              </div>
              {field.description && <span className="description">{field.description}</span>}
            </div>
          );

        default:
          return null;
      }
    },
    [getValue, setValue, isFieldVisible, validationErrors]
  );

  // Group fields by section
  const groupedFields = useMemo(() => {
    const groups: Record<string, ConfigFormField[]> = { basic: [] };

    formFields.forEach((field) => {
      const section = field.name.includes('.') ? field.name.split('.')[0] : 'basic';
      if (!groups[section]) {
        groups[section] = [];
      }
      groups[section].push(field);
    });

    return groups;
  }, [formFields]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  if (!module) {
    return (
      <div className="module-config-panel error">
        <p>Module not found: {moduleId}</p>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="module-config-panel">
      <div className="panel-header">
        <div className="header-title">
          <Settings size={18} />
          <span>{module.name} Configuration</span>
        </div>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        )}
      </div>

      <div className="panel-content">
        {!isUnlocked && module.requiredCredentialTypes?.length ? (
          <div className="warning-banner">
            <AlertTriangle size={16} />
            <span>Unlock credential store to configure credentials</span>
          </div>
        ) : null}

        {formFields.length === 0 ? (
          <div className="no-config">
            <p>This module has no configuration options.</p>
            <p className="hint">You can still use default settings.</p>
          </div>
        ) : (
          Object.entries(groupedFields).map(([section, fields]) => (
            <div key={section} className="config-section">
              {section !== 'basic' && (
                <button
                  type="button"
                  className="section-header"
                  onClick={() => toggleSection(section)}
                >
                  <span className="section-title">
                    {section.charAt(0).toUpperCase() + section.slice(1)}
                  </span>
                  {expandedSections.has(section) ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>
              )}
              {(section === 'basic' || expandedSections.has(section)) && (
                <div className="section-content">{fields.map(renderField)}</div>
              )}
            </div>
          ))
        )}

        {!validation.success && (
          <div className="validation-errors">
            <h4>
              <AlertTriangle size={14} />
              Validation Errors
            </h4>
            <ul>
              {validation.errors.issues.map((issue, i) => (
                <li key={i}>
                  <strong>{issue.path.join('.')}</strong>: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {validation.success && formFields.length > 0 && (
          <div className="validation-success">
            <Check size={14} />
            <span>Configuration is valid</span>
          </div>
        )}
      </div>

      {addCredentialType && (
        <AddCredentialDialog
          type={addCredentialType as any}
          isOpen={true}
          onClose={() => setAddCredentialType(null)}
          onSave={async (name, values, description) => {
            await addCredential(addCredentialType as any, name, values, description);
          }}
        />
      )}

      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .module-config-panel {
    background: rgba(26, 26, 46, 0.95);
    border: 1px solid rgba(0, 255, 65, 0.3);
    border-radius: 8px;
    overflow: hidden;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .module-config-panel.error {
    padding: 20px;
    color: #ff6b6b;
    text-align: center;
  }

  .module-config-panel .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: rgba(0, 255, 65, 0.1);
    border-bottom: 1px solid rgba(0, 255, 65, 0.2);
  }

  .module-config-panel .header-title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #00ff41;
    font-weight: 600;
    font-size: 14px;
  }

  .module-config-panel .close-btn {
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .module-config-panel .close-btn:hover {
    color: #ff6b6b;
  }

  .module-config-panel .panel-content {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }

  .module-config-panel .warning-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: rgba(255, 187, 36, 0.1);
    border: 1px solid rgba(255, 187, 36, 0.3);
    border-radius: 6px;
    color: #fbbf24;
    font-size: 12px;
    margin-bottom: 16px;
  }

  .module-config-panel .no-config {
    text-align: center;
    padding: 24px;
    color: #888;
  }

  .module-config-panel .no-config .hint {
    font-size: 12px;
    color: #666;
    margin-top: 8px;
  }

  .module-config-panel .config-section {
    margin-bottom: 8px;
  }

  .module-config-panel .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 12px;
    background: rgba(0, 255, 65, 0.05);
    border: 1px solid rgba(0, 255, 65, 0.2);
    border-radius: 6px;
    color: #00ff41;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    margin-bottom: 8px;
  }

  .module-config-panel .section-header:hover {
    background: rgba(0, 255, 65, 0.1);
  }

  .module-config-panel .section-content {
    padding: 8px 0;
  }

  .module-config-panel .form-field {
    margin-bottom: 16px;
  }

  .module-config-panel .form-field label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #888;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .module-config-panel .form-field .required {
    color: #ff6b6b;
    margin-left: 4px;
  }

  .module-config-panel .form-field input[type="text"],
  .module-config-panel .form-field input[type="password"],
  .module-config-panel .form-field input[type="number"],
  .module-config-panel .form-field select,
  .module-config-panel .form-field textarea {
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

  .module-config-panel .form-field input:focus,
  .module-config-panel .form-field select:focus,
  .module-config-panel .form-field textarea:focus {
    outline: none;
    border-color: #00ff41;
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.3);
  }

  .module-config-panel .form-field select option {
    background: #1a1a2e;
    color: #e0e0e0;
  }

  .module-config-panel .form-field textarea {
    resize: vertical;
    min-height: 80px;
  }

  .module-config-panel .form-field textarea.json-input {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
  }

  .module-config-panel .form-field .description {
    display: block;
    font-size: 11px;
    color: #666;
    margin-top: 4px;
    font-style: italic;
  }

  .module-config-panel .form-field .error {
    display: block;
    font-size: 11px;
    color: #ff6b6b;
    margin-top: 4px;
  }

  .module-config-panel .checkbox-field .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    margin-bottom: 0;
  }

  .module-config-panel .checkbox-field input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #00ff41;
  }

  .module-config-panel .checkbox-field .checkbox-text {
    color: #e0e0e0;
    font-size: 13px;
    text-transform: none;
    font-weight: normal;
  }

  .module-config-panel .multiselect {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    background: rgba(0, 255, 65, 0.05);
    border: 1px solid rgba(0, 255, 65, 0.3);
    border-radius: 4px;
  }

  .module-config-panel .multiselect-option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #e0e0e0;
    cursor: pointer;
  }

  .module-config-panel .array-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .module-config-panel .array-item {
    display: flex;
    gap: 8px;
  }

  .module-config-panel .array-item input {
    flex: 1;
  }

  .module-config-panel .array-item .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.3);
    border-radius: 4px;
    color: #ff6b6b;
    cursor: pointer;
  }

  .module-config-panel .array-item .remove-btn:hover {
    background: rgba(255, 107, 107, 0.2);
  }

  .module-config-panel .array-field .add-btn {
    padding: 8px;
    background: rgba(0, 255, 65, 0.1);
    border: 1px dashed rgba(0, 255, 65, 0.3);
    border-radius: 4px;
    color: #00ff41;
    font-size: 12px;
    cursor: pointer;
  }

  .module-config-panel .array-field .add-btn:hover {
    background: rgba(0, 255, 65, 0.2);
    border-style: solid;
  }

  .module-config-panel .validation-errors {
    padding: 12px;
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.3);
    border-radius: 6px;
    margin-top: 16px;
  }

  .module-config-panel .validation-errors h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #ff6b6b;
    font-size: 12px;
    margin: 0 0 8px 0;
  }

  .module-config-panel .validation-errors ul {
    margin: 0;
    padding-left: 20px;
    font-size: 11px;
    color: #ff6b6b;
  }

  .module-config-panel .validation-errors li {
    margin-bottom: 4px;
  }

  .module-config-panel .validation-success {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(0, 255, 65, 0.1);
    border: 1px solid rgba(0, 255, 65, 0.3);
    border-radius: 6px;
    color: #00ff41;
    font-size: 12px;
    margin-top: 16px;
  }
`;

export default ModuleConfigPanel;
