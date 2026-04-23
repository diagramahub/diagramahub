export type VendorConfigResponse = {
  id: string;
  vendor_type: string;
  category: string;
  display_name: string;
  is_configured: boolean;
  is_default: boolean;
  is_active_payment: boolean;
  is_active_oauth: boolean;
  connection_tested: boolean;
  last_test_at: string | null;
  last_test_success: boolean;
  config_fields: string[];
  created_at: string;
};

export type IntegrationStatus = {
  email: {
    configured_count: number;
    default_vendor: string | null;
    has_default: boolean;
  };
  payment: {
    configured_count: number;
    active_vendor: string | null;
    has_active: boolean;
  };
};

export type VendorConfigCreate = {
  vendor_type: string;
  category: 'email' | 'payment' | 'oauth';
  display_name: string;
  config: Record<string, string>;
};

export type VendorConfigUpdate = {
  display_name?: string;
  config?: Record<string, string>;
};

export type TestConnectionResponse = {
  success: boolean;
  message: string;
  error_detail?: string | null;
};
