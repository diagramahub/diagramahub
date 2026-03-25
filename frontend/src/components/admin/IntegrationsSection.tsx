import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { VendorConfigResponse, IntegrationStatus, VendorConfigCreate, VendorConfigUpdate } from '../../types/integrations';

/* ── vendor catalogue (available to connect) ─────────────────────── */
type VendorCatalogEntry = {
  vendor_type: string;
  category: 'email' | 'payment';
  label: string;
  description: string;
  logo: string; // path to logo image in /integrations/
  fields: { key: string; label: string; placeholder: string; type?: string }[];
};

const VENDOR_CATALOG: VendorCatalogEntry[] = [
  {
    vendor_type: 'resend',
    category: 'email',
    label: 'Resend',
    description: 'integrations.catalog.resendDesc',
    logo: '/integrations/resend.svg',
    fields: [
      { key: 'api_key', label: 'integrations.form.apiKey', placeholder: 'integrations.form.apiKeyPlaceholder' },
      { key: 'from_email', label: 'integrations.form.fromEmail', placeholder: 'integrations.form.fromEmailPlaceholder', type: 'email' },
    ],
  },
  {
    vendor_type: 'stripe',
    category: 'payment',
    label: 'Stripe',
    description: 'integrations.catalog.stripeDesc',
    logo: '/integrations/stripe.svg',
    fields: [
      { key: 'secret_key', label: 'integrations.form.secretKey', placeholder: 'integrations.form.secretKeyPlaceholder' },
      { key: 'publishable_key', label: 'integrations.form.publishableKey', placeholder: 'integrations.form.publishableKeyPlaceholder' },
      { key: 'webhook_secret', label: 'integrations.form.webhookSecret', placeholder: 'integrations.form.webhookSecretPlaceholder' },
    ],
  },
];

/** Get the logo path for a vendor type */
const getVendorLogo = (vendorType: string): string => {
  return VENDOR_CATALOG.find(c => c.vendor_type === vendorType)?.logo || '';
};

/** Reusable logo component */
const VendorLogo = ({ vendorType, size = 'md' }: { vendorType: string; size?: 'sm' | 'md' | 'lg' }) => {
  const logo = getVendorLogo(vendorType);
  const label = VENDOR_CATALOG.find(c => c.vendor_type === vendorType)?.label || vendorType;
  const sizeClasses = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
  return (
    <div className={`${sizeClasses[size]} rounded-lg border border-gray-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0`}>
      {logo ? (
        <img src={logo} alt={label} className="w-3/4 h-3/4 object-contain" />
      ) : (
        <span className="text-lg font-bold text-gray-400">{label.charAt(0)}</span>
      )}
    </div>
  );
};

type Tab = 'available' | 'connected';
type CategoryFilter = 'all' | 'email' | 'payment';

export default function IntegrationsSection() {
  const { t } = useTranslation();

  /* ── data state ──────────────────────────────────────────────── */
  const [vendors, setVendors] = useState<VendorConfigResponse[]>([]);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  /* ── UI state ────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<Tab>('available');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  /* ── form state (connect / edit modal) ───────────────────────── */
  const [connectingVendor, setConnectingVendor] = useState<VendorCatalogEntry | null>(null);
  const [editingVendor, setEditingVendor] = useState<VendorConfigResponse | null>(null);
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  /* ── action loading states ───────────────────────────────────── */
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ── effects ─────────────────────────────────────────────────── */
  useEffect(() => { loadIntegrations(); }, []);
  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(''), 4000); return () => clearTimeout(t); }
  }, [successMsg]);

  /* ── data helpers ────────────────────────────────────────────── */
  const loadIntegrations = async () => {
    try {
      setLoading(true); setError('');
      const [emailData, paymentData, statusData] = await Promise.all([
        apiService.getIntegrationVendors('email'),
        apiService.getIntegrationVendors('payment'),
        apiService.getIntegrationStatus(),
      ]);
      setVendors([...emailData, ...paymentData]);
      setStatus(statusData);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error loading integrations');
    } finally { setLoading(false); }
  };

  const connectedTypes = new Set(vendors.map(v => v.vendor_type));

  const filteredCatalog = VENDOR_CATALOG.filter(c =>
    (categoryFilter === 'all' || c.category === categoryFilter) && !connectedTypes.has(c.vendor_type)
  );

  const filteredConnected = vendors.filter(v =>
    categoryFilter === 'all' || v.category === categoryFilter
  );

  /* ── form helpers ────────────────────────────────────────────── */
  const resetForm = () => {
    setConnectingVendor(null); setEditingVendor(null);
    setFormConfig({}); setFormError('');
  };

  const openConnect = (entry: VendorCatalogEntry) => {
    resetForm(); setConnectingVendor(entry);
  };

  const openEdit = async (vendor: VendorConfigResponse) => {
    resetForm();
    const catalog = VENDOR_CATALOG.find(c => c.vendor_type === vendor.vendor_type);
    if (catalog) setConnectingVendor(catalog);
    setEditingVendor(vendor);
    // Load masked config from backend
    try {
      const data = await apiService.getIntegrationVendorConfig(vendor.id);
      setFormConfig(data.config);
    } catch {
      setFormConfig({});
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    const fields = connectingVendor?.fields || [];
    if (!editingVendor) {
      for (const f of fields) { if (!formConfig[f.key]?.trim()) { setFormError(t('validation.allFieldsRequired')); return; } }
    }
    try {
      setFormSaving(true);
      if (editingVendor) {
        // Only send fields that were actually changed (not masked values)
        const changedConfig: Record<string, string> = {};
        for (const [k, v] of Object.entries(formConfig)) {
          if (v && !v.startsWith('•')) changedConfig[k] = v;
        }
        const data: VendorConfigUpdate = {};
        if (Object.keys(changedConfig).length > 0) data.config = changedConfig;
        await apiService.updateIntegrationVendor(editingVendor.id, data);
        setSuccessMsg(t('integrations.messages.vendorUpdated'));
      } else {
        const data: VendorConfigCreate = {
          vendor_type: connectingVendor!.vendor_type,
          category: connectingVendor!.category,
          display_name: connectingVendor!.label,
          config: formConfig,
        };
        await apiService.createIntegrationVendor(data);
        setSuccessMsg(t('integrations.messages.vendorCreated'));
      }
      resetForm(); await loadIntegrations();
      setActiveTab('connected');
    } catch (err: any) { setFormError(err.response?.data?.detail || t('errors.genericError')); }
    finally { setFormSaving(false); }
  };

  /* ── actions ─────────────────────────────────────────────────── */
  const handleTest = async (id: string) => {
    try {
      setTestingId(id); setTestResult(null);
      const r = await apiService.testIntegrationVendor(id);
      setTestResult({ id, success: r.success, message: r.success ? t('integrations.messages.testSuccess') : (r.error_detail || r.message) });
      await loadIntegrations();
    } catch (err: any) { setTestResult({ id, success: false, message: err.response?.data?.detail || t('integrations.messages.testFailed') }); }
    finally { setTestingId(null); }
  };

  const handleSetDefault = async (id: string, cat: string) => {
    try {
      setSettingDefaultId(id);
      await apiService.setDefaultIntegrationVendor(id);
      setSuccessMsg(cat === 'email' ? t('integrations.messages.setDefaultSuccess') : t('integrations.messages.activateSuccess'));
      await loadIntegrations();
    } catch (err: any) { setError(err.response?.data?.detail || t('integrations.messages.mustTestFirst')); }
    finally { setSettingDefaultId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('integrations.messages.deleteConfirm'))) return;
    try {
      setDeletingId(id);
      await apiService.deleteIntegrationVendor(id);
      setSuccessMsg(t('integrations.messages.vendorDeleted'));
      await loadIntegrations();
    } catch (err: any) { setError(err.response?.data?.detail || t('errors.genericError')); }
    finally { setDeletingId(null); }
  };

  /* ── badge helpers ───────────────────────────────────────────── */
  const statusBadge = (v: VendorConfigResponse) => {
    if (v.is_default) return <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-800 rounded-full">{t('integrations.status.default')}</span>;
    if (v.is_active_payment) return <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-800 rounded-full">{t('integrations.status.activePayment')}</span>;
    return <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">{t('integrations.status.configured')}</span>;
  };

  const categoryBadge = (cat: string) => (
    <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full capitalize">{cat === 'email' ? t('integrations.categories.email') : t('integrations.categories.payment')}</span>
  );

  /* ── loading ─────────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
    </div>
  );

  /* ── modal overlay for connect / edit form ────────────────────── */
  const formFields = connectingVendor?.fields || [];
  const showModal = connectingVendor !== null;

  /* ── render ──────────────────────────────────────────────────── */
  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">{t('integrations.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('integrations.subtitle')}</p>
      </div>

      {/* Alerts */}
      {successMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{successMsg}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
      {status && !status.email.has_default && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          <p className="text-sm text-amber-800">{t('integrations.noDefaultEmailWarning')}</p>
        </div>
      )}

      {/* Tabs + Filter row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'available' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t('integrations.tabs.available')} ({filteredCatalog.length + connectedTypes.size})
          </button>
          <button
            onClick={() => setActiveTab('connected')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'connected' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t('integrations.tabs.connected')} ({filteredConnected.length})
          </button>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{t('integrations.filterCategory')}:</span>
          {(['all', 'email', 'payment'] as CategoryFilter[]).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${categoryFilter === cat ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'}`}
            >
              {cat === 'all' ? t('integrations.filterAll') : cat === 'email' ? t('integrations.categories.email') : t('integrations.categories.payment')}
            </button>
          ))}
        </div>
      </div>

      {/* ── AVAILABLE TAB ──────────────────────────────────────────── */}
      {activeTab === 'available' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {VENDOR_CATALOG.filter(c => categoryFilter === 'all' || c.category === categoryFilter).map(entry => {
            const isConnected = connectedTypes.has(entry.vendor_type);
            return (
              <div key={entry.vendor_type} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <VendorLogo vendorType={entry.vendor_type} size="lg" />
                      <span className="text-base font-semibold text-gray-900">{entry.label}</span>
                    </div>
                    {categoryBadge(entry.category)}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{t(entry.description)}</p>
                </div>
                {isConnected ? (
                  <button disabled className="w-full py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg cursor-default">
                    ✓ {t('integrations.alreadyConnected')}
                  </button>
                ) : (
                  <button
                    onClick={() => openConnect(entry)}
                    className="w-full py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                  >
                    {t('integrations.connect')}
                  </button>
                )}
              </div>
            );
          })}
          {VENDOR_CATALOG.filter(c => categoryFilter === 'all' || c.category === categoryFilter).length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400 text-sm">{t('integrations.noVendorsInCategory')}</div>
          )}
        </div>
      )}

      {/* ── CONNECTED TAB ──────────────────────────────────────────── */}
      {activeTab === 'connected' && (
        <>
          {filteredConnected.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="mx-auto h-10 w-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              <p className="text-sm">{t('integrations.noConnected')}</p>
              <button onClick={() => setActiveTab('available')} className="mt-3 text-sm text-purple-600 hover:underline">{t('integrations.goToAvailable')}</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredConnected.map(vendor => (
                <div key={vendor.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <VendorLogo vendorType={vendor.vendor_type} size="lg" />
                        <span className="text-base font-semibold text-gray-900">{vendor.display_name}</span>
                      </div>
                      {statusBadge(vendor)}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      {categoryBadge(vendor.category)}
                      {vendor.connection_tested && vendor.last_test_success && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                          {t('integrations.status.tested')}
                        </span>
                      )}
                      {vendor.connection_tested && !vendor.last_test_success && (
                        <span className="text-xs text-red-500">{t('integrations.status.testFailed')}</span>
                      )}
                      {!vendor.connection_tested && (
                        <span className="text-xs text-gray-400">{t('integrations.status.notTested')}</span>
                      )}
                    </div>
                    {/* Test result inline */}
                    {testResult && testResult.id === vendor.id && (
                      <div className={`mb-3 p-2 rounded text-xs ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {testResult.message}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button onClick={() => handleTest(vendor.id)} disabled={testingId === vendor.id}
                      className="flex-1 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 flex items-center justify-center gap-1">
                      {testingId === vendor.id ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" /> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                      {t('integrations.testConnection')}
                    </button>
                    {vendor.category === 'email' && !vendor.is_default && (
                      <button onClick={() => handleSetDefault(vendor.id, vendor.category)} disabled={settingDefaultId === vendor.id}
                        className="flex-1 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 flex items-center justify-center gap-1">
                        {settingDefaultId === vendor.id ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600" /> : null}
                        {t('integrations.setAsDefault')}
                      </button>
                    )}
                    {vendor.category === 'payment' && !vendor.is_active_payment && (
                      <button onClick={() => handleSetDefault(vendor.id, vendor.category)} disabled={settingDefaultId === vendor.id}
                        className="flex-1 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 flex items-center justify-center gap-1">
                        {settingDefaultId === vendor.id ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600" /> : null}
                        {t('integrations.activateForPayments')}
                      </button>
                    )}
                    <button onClick={() => openEdit(vendor)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-gray-100 rounded-lg" title={t('integrations.editVendor')}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(vendor.id)} disabled={deletingId === vendor.id} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title={t('integrations.deleteVendor')}>
                      {deletingId === vendor.id ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600" /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CONNECT / EDIT MODAL ───────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={resetForm}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <VendorLogo vendorType={connectingVendor?.vendor_type || ''} size="lg" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingVendor ? t('integrations.editVendor') : t('integrations.connect')} — {connectingVendor?.label}
                </h3>
                <p className="text-xs text-gray-500">{t(connectingVendor?.description || '')}</p>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Dynamic fields */}
              {formFields.map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t(f.label)}</label>
                  <input type={f.type || 'text'} value={formConfig[f.key] || ''} onChange={e => setFormConfig({ ...formConfig, [f.key]: e.target.value })}
                    placeholder={editingVendor ? t('integrations.form.leaveBlankToKeep') : t(f.placeholder)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
                </div>
              ))}

              {formError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{formError}</div>}

              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={formSaving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {formSaving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                  {editingVendor ? t('common.save') : t('integrations.connect')}
                </button>
                <button type="button" onClick={resetForm}
                  className="flex-1 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
