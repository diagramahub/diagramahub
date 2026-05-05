import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import {
  LoginRequest,
  RegisterRequest,
  User,
  ChangePasswordRequest,
  ResetPasswordRequest,
  ResetPasswordConfirm,
  UpdateProfileRequest,
  InstallationStatus,
  LoginResponse,
  MfaSetupTotpResponse,
  RecoveryCodesResponse,
  MfaVerifyResponse,
  MfaResendResponse,
  MfaStatusResponse,
  PaginatedAdminUsers
} from '../types/auth';
import {
  Project,
  Diagram,
  ProjectWithDiagrams,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateDiagramRequest,
  UpdateDiagramRequest,
  Folder,
  FolderWithDiagrams,
  CreateFolderRequest,
  UpdateFolderRequest
} from '../types/project';
import {
  UserAISettings,
  CreateProviderRequest,
  UpdateProviderRequest,
  TestProviderRequest,
  TestProviderResponse,
  GenerateDescriptionRequest,
  GenerateDescriptionResponse,
  RefineDescriptionRequest,
  RefineDescriptionResponse,
  GenerateDiagramRequest,
  GenerateDiagramResponse,
  ImproveDiagramRequest,
  ImproveDiagramResponse,
  AIProviderType,
  FixDiagramRequest,
  FixDiagramResponse
} from '../types/ai';
import {
  Plan,
  PlanCreate,
  PlanUpdate,
  Subscription,
  UsageSummary,
  CurrencyPriceRequest
} from '../types/subscription';
import {
  PaginatedPromptHistory,
  PromptHistoryEntry
} from '../types/promptHistory';
import {
  ChatSession,
  ChatMessage,
  ChatSessionWithMessages,
  CreateChatSessionRequest,
  SendMessageRequest,
  UpdateMessageStatusRequest,
  UpdateSessionTitleRequest,
  UpdateSessionModelRequest
} from '../types/chat';
import {
  SharedLink,
  SharedLinkInfo,
  SharedDiagram,
  CreateSharedLinkRequest,
  UpdateSharedLinkRequest,
  VerifyAccessCodeRequest
} from '../types/sharing';
import {
  VendorConfigResponse,
  VendorConfigCreate,
  VendorConfigUpdate,
  TestConnectionResponse,
  IntegrationStatus
} from '../types/integrations';
import {
  ActiveOAuthProvider,
  OAuthCallbackRequest,
  OAuthCallbackResponse,
  OAuthAuthorizeResponse
} from '../types/oauth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5172';

class ApiService {
  private api: AxiosInstance;
  private publicApi: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Public axios instance without auth interceptor (for shared link public endpoints)
    this.publicApi = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add token and language
    this.api.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Send current i18n language so backend can localize emails
        const lang = localStorage.getItem('i18nextLng') || 'es';
        if (config.headers) {
          config.headers['Accept-Language'] = lang;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Public API also sends language header
    this.publicApi.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const lang = localStorage.getItem('i18nextLng') || 'es';
        if (config.headers) {
          config.headers['Accept-Language'] = lang;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async checkInstallationStatus(): Promise<InstallationStatus> {
    const response = await this.api.get<InstallationStatus>('/api/v1/users/installation-status');
    return response.data;
  }

  async register(data: RegisterRequest): Promise<User> {
    const response = await this.api.post<User>('/api/v1/users/register', data);
    return response.data;
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.api.post<LoginResponse>('/api/v1/users/login', data);
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.api.get<User>('/api/v1/users/me');
    return response.data;
  }

  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    const response = await this.api.put<User>('/api/v1/users/me', data);
    return response.data;
  }

  async changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
    const response = await this.api.put<{ message: string }>('/api/v1/users/change-password', data);
    return response.data;
  }

  async requestPasswordReset(data: ResetPasswordRequest): Promise<{ message: string; token?: string }> {
    const response = await this.api.post<{ message: string; token?: string }>('/api/v1/users/reset-password-request', data);
    return response.data;
  }

  async confirmPasswordReset(data: ResetPasswordConfirm): Promise<{ message: string }> {
    const response = await this.api.post<{ message: string }>('/api/v1/users/reset-password-confirm', data);
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string }> {
    const response = await this.api.get<{ status: string }>('/health');
    return response.data;
  }

  // Project endpoints
  async getProjects(): Promise<Project[]> {
    const response = await this.api.get<Project[]>('/api/v1/projects');
    return response.data;
  }

  async getProject(projectId: string): Promise<ProjectWithDiagrams> {
    const response = await this.api.get<ProjectWithDiagrams>(`/api/v1/projects/${projectId}`);
    return response.data;
  }

  async createProject(data: CreateProjectRequest): Promise<Project> {
    const response = await this.api.post<Project>('/api/v1/projects', data);
    return response.data;
  }

  async updateProject(projectId: string, data: UpdateProjectRequest): Promise<Project> {
    const response = await this.api.put<Project>(`/api/v1/projects/${projectId}`, data);
    return response.data;
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.api.delete(`/api/v1/projects/${projectId}`);
  }

  // Diagram endpoints
  async getDiagram(diagramId: string): Promise<Diagram> {
    const response = await this.api.get<Diagram>(`/api/v1/diagrams/${diagramId}`);
    return response.data;
  }

  async createDiagram(projectId: string, data: CreateDiagramRequest): Promise<Diagram> {
    const response = await this.api.post<Diagram>(`/api/v1/projects/${projectId}/diagrams`, data);
    return response.data;
  }

  async updateDiagram(diagramId: string, data: UpdateDiagramRequest): Promise<Diagram> {
    const response = await this.api.put<Diagram>(`/api/v1/diagrams/${diagramId}`, data);
    return response.data;
  }

  async deleteDiagram(diagramId: string): Promise<void> {
    await this.api.delete(`/api/v1/diagrams/${diagramId}`);
  }

  // Folder endpoints
  async getFolder(folderId: string): Promise<FolderWithDiagrams> {
    const response = await this.api.get<FolderWithDiagrams>(`/api/v1/folders/${folderId}`);
    return response.data;
  }

  async createFolder(projectId: string, data: CreateFolderRequest): Promise<Folder> {
    const response = await this.api.post<Folder>(`/api/v1/projects/${projectId}/folders`, data);
    return response.data;
  }

  async updateFolder(folderId: string, data: UpdateFolderRequest): Promise<Folder> {
    const response = await this.api.put<Folder>(`/api/v1/folders/${folderId}`, data);
    return response.data;
  }

  async deleteFolder(folderId: string, deleteDiagrams: boolean = false): Promise<void> {
    console.log('API deleteFolder called with:', { folderId, deleteDiagrams });
    const response = await this.api.delete(`/api/v1/folders/${folderId}`, {
      params: { delete_diagrams: deleteDiagrams }
    });
    console.log('Delete folder response:', response.data);
  }

  // AI Provider endpoints
  async getAISettings(): Promise<UserAISettings> {
    const response = await this.api.get<UserAISettings>('/api/v1/ai/settings');
    return response.data;
  }

  async addAIProvider(data: CreateProviderRequest): Promise<UserAISettings> {
    const response = await this.api.post<UserAISettings>('/api/v1/ai/providers', data);
    return response.data;
  }

  async updateAIProvider(providerIndex: number, data: UpdateProviderRequest): Promise<UserAISettings> {
    const response = await this.api.put<UserAISettings>(`/api/v1/ai/providers/${providerIndex}`, data);
    return response.data;
  }

  async removeAIProvider(providerIndex: number): Promise<UserAISettings> {
    const response = await this.api.delete<UserAISettings>(`/api/v1/ai/providers/${providerIndex}`);
    return response.data;
  }

  async setDefaultAIProvider(provider: AIProviderType): Promise<UserAISettings> {
    const response = await this.api.put<UserAISettings>('/api/v1/ai/settings/default-provider', { provider });
    return response.data;
  }

  async testAIProvider(data: TestProviderRequest): Promise<TestProviderResponse> {
    const response = await this.api.post<TestProviderResponse>('/api/v1/ai/test-provider', data);
    return response.data;
  }

  async generateDescription(data: GenerateDescriptionRequest): Promise<GenerateDescriptionResponse> {
    const response = await this.api.post<GenerateDescriptionResponse>('/api/v1/ai/generate-description', data);
    return response.data;
  }

  async refineDescription(data: RefineDescriptionRequest): Promise<RefineDescriptionResponse> {
    const response = await this.api.post<RefineDescriptionResponse>('/api/v1/ai/refine-description', data);
    return response.data;
  }

  async generateDiagram(data: GenerateDiagramRequest): Promise<GenerateDiagramResponse> {
    const response = await this.api.post<GenerateDiagramResponse>('/api/v1/ai/generate-diagram', data);
    return response.data;
  }

  async improveDiagram(data: ImproveDiagramRequest): Promise<ImproveDiagramResponse> {
    const response = await this.api.post<ImproveDiagramResponse>('/api/v1/ai/improve-diagram', data);
    return response.data;
  }

  async fixDiagram(diagramId: string, data: FixDiagramRequest): Promise<FixDiagramResponse> {
    const response = await this.api.post<FixDiagramResponse>(`/api/v1/diagrams/${diagramId}/fix`, data);
    return response.data;
  }

  // ============================================================================
  // Subscription & Plans API
  // ============================================================================

  // Plans (Public)
  async getPlans(): Promise<Plan[]> {
    const response = await this.api.get<Plan[]>('/api/v1/plans');
    return response.data;
  }

  async getPlan(planId: string): Promise<Plan> {
    const response = await this.api.get<Plan>(`/api/v1/plans/${planId}`);
    return response.data;
  }

  // Plans (Admin)
  async getAllPlans(): Promise<Plan[]> {
    const response = await this.api.get<Plan[]>('/api/v1/admin/plans');
    return response.data;
  }

  async createPlan(data: PlanCreate): Promise<Plan> {
    const response = await this.api.post<Plan>('/api/v1/admin/plans', data);
    return response.data;
  }

  async updatePlan(planId: string, data: PlanUpdate): Promise<Plan> {
    const response = await this.api.put<Plan>(`/api/v1/admin/plans/${planId}`, data);
    return response.data;
  }

  async deactivatePlan(planId: string): Promise<any> {
    const response = await this.api.delete(`/api/v1/admin/plans/${planId}`);
    return response.data;
  }

  async addPlanPrice(planId: string, data: CurrencyPriceRequest): Promise<Plan> {
    const response = await this.api.post<Plan>(`/api/v1/admin/plans/${planId}/prices`, data);
    return response.data;
  }

  async removePlanPrice(planId: string, currency: string): Promise<Plan> {
    const response = await this.api.delete<Plan>(`/api/v1/admin/plans/${planId}/prices/${currency}`);
    return response.data;
  }

  // Subscriptions
  async getMySubscription(): Promise<Subscription> {
    const response = await this.api.get<Subscription>('/api/v1/subscriptions/me');
    return response.data;
  }

  async getUsageSummary(): Promise<UsageSummary> {
    const response = await this.api.get<UsageSummary>('/api/v1/subscriptions/usage');
    return response.data;
  }

  async initiateCheckout(planId: string): Promise<{ session_url?: string; message?: string }> {
    const response = await this.api.post('/api/v1/subscriptions/checkout', { plan_id: planId });
    return response.data;
  }

  async cancelSubscription(immediate: boolean = false): Promise<any> {
    const response = await this.api.post(`/api/v1/subscriptions/cancel?immediate=${immediate}`);
    return response.data;
  }

  async updatePaymentMethod(): Promise<{ session_id: string; session_url: string }> {
    const response = await this.api.post('/api/v1/subscriptions/update-payment-method');
    return response.data;
  }

  // Billing History
  async getBillingHistory(limit: number = 10): Promise<{ invoices: any[]; total_count: number }> {
    const response = await this.api.get(`/api/v1/subscriptions/billing-history?limit=${limit}`);
    return response.data;
  }

  async downloadInvoice(invoiceId: string): Promise<{ pdf_url: string }> {
    const response = await this.api.get(`/api/v1/subscriptions/invoices/${invoiceId}/pdf-url`);
    return response.data;
  }

  // ============================================================================
  // Prompt History API
  // ============================================================================

  async getPromptHistory(params: { page?: number; page_size?: number; search?: string; diagram_id?: string }): Promise<PaginatedPromptHistory> {
    const response = await this.api.get<PaginatedPromptHistory>('/api/v1/prompt-history', { params });
    return response.data;
  }

  async savePromptHistory(data: { prompt_text: string; operation_type: string; diagram_id?: string }): Promise<PromptHistoryEntry> {
    const response = await this.api.post<PromptHistoryEntry>('/api/v1/prompt-history', data);
    return response.data;
  }

  async deletePromptHistory(entryId: string): Promise<void> {
    await this.api.delete(`/api/v1/prompt-history/${entryId}`);
  }

  // ============================================================================
  // Account Deletion API
  // ============================================================================

  async deleteAccount(confirmationPhrase: string): Promise<{ message: string }> {
    const response = await this.api.delete<{ message: string }>('/api/v1/users/me', {
      data: { confirmation_phrase: confirmationPhrase }
    });
    return response.data;
  }

  async getAdminCount(): Promise<{ count: number }> {
    const response = await this.api.get<{ count: number }>('/api/v1/users/admin-count');
    return response.data;
  }

  // ============================================================================
  // Chat Sessions API
  // ============================================================================

  async createChatSession(data: CreateChatSessionRequest): Promise<ChatSession> {
    const response = await this.api.post<ChatSession>('/api/v1/chat-sessions', data);
    return response.data;
  }

  async getChatSessions(diagramId: string): Promise<ChatSession[]> {
    const response = await this.api.get<ChatSession[]>('/api/v1/chat-sessions', {
      params: { diagram_id: diagramId }
    });
    return response.data;
  }

  async getChatSessionWithMessages(sessionId: string): Promise<ChatSessionWithMessages> {
    const response = await this.api.get<ChatSessionWithMessages>(`/api/v1/chat-sessions/${sessionId}`);
    return response.data;
  }

  async updateChatSessionTitle(sessionId: string, data: UpdateSessionTitleRequest): Promise<ChatSession> {
    const response = await this.api.put<ChatSession>(`/api/v1/chat-sessions/${sessionId}`, data);
    return response.data;
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    await this.api.delete(`/api/v1/chat-sessions/${sessionId}`);
  }

  async updateChatSessionModel(sessionId: string, data: UpdateSessionModelRequest): Promise<ChatSession> {
    const response = await this.api.put<ChatSession>(`/api/v1/chat-sessions/${sessionId}/model`, data);
    return response.data;
  }

  async sendChatMessage(sessionId: string, data: SendMessageRequest): Promise<ChatMessage> {
    const response = await this.api.post<ChatMessage>(`/api/v1/chat-sessions/${sessionId}/messages`, data);
    return response.data;
  }

  async deleteChatMessage(sessionId: string, messageId: string): Promise<void> {
    await this.api.delete(`/api/v1/chat-sessions/${sessionId}/messages/${messageId}`);
  }

  async updateMessageStatus(sessionId: string, messageId: string, data: UpdateMessageStatusRequest): Promise<ChatMessage> {
    const response = await this.api.put<ChatMessage>(`/api/v1/chat-sessions/${sessionId}/messages/${messageId}/status`, data);
    return response.data;
  }

  async getProviderUsageStats(): Promise<{ provider_counts: Record<string, number>; total_messages: number }> {
    const response = await this.api.get<{ provider_counts: Record<string, number>; total_messages: number }>('/api/v1/chat-sessions/stats/provider-usage');
    return response.data;
  }

  // ============================================================================
  // Shared Links API (Authenticated - for diagram owners)
  // ============================================================================

  async createSharedLink(data: CreateSharedLinkRequest): Promise<SharedLink> {
    const response = await this.api.post<SharedLink>('/api/v1/shared-links', data);
    return response.data;
  }

  async getSharedLinkByDiagram(diagramId: string): Promise<SharedLink> {
    const response = await this.api.get<SharedLink>(`/api/v1/shared-links/diagram/${diagramId}`);
    return response.data;
  }

  async updateSharedLink(linkId: string, data: UpdateSharedLinkRequest): Promise<SharedLink> {
    const response = await this.api.put<SharedLink>(`/api/v1/shared-links/${linkId}`, data);
    return response.data;
  }

  async revokeSharedLink(linkId: string): Promise<void> {
    await this.api.delete(`/api/v1/shared-links/${linkId}`);
  }

  // ============================================================================
  // Shared Links API (Public - no auth, for visitors)
  // ============================================================================

  async getSharedLinkInfo(token: string): Promise<SharedLinkInfo> {
    const response = await this.publicApi.get<SharedLinkInfo>(`/api/v1/shared/${token}/info`);
    return response.data;
  }

  async getSharedDiagram(token: string): Promise<SharedDiagram> {
    const response = await this.publicApi.get<SharedDiagram>(`/api/v1/shared/${token}/diagram`);
    return response.data;
  }

  async verifyAccessCode(token: string, data: VerifyAccessCodeRequest): Promise<SharedDiagram> {
    const response = await this.publicApi.post<SharedDiagram>(`/api/v1/shared/${token}/verify`, data);
    return response.data;
  }

  // ============================================================================
  // Diagram Rendering API (Public — no auth, uses Kroki backend)
  // ============================================================================

  async renderDiagram(source: string, diagramType: string): Promise<string> {
    const response = await this.publicApi.post(
      '/api/v1/diagrams/render',
      { source, diagram_type: diagramType },
      { responseType: 'text', headers: { 'Accept': 'image/svg+xml' } }
    );
    return response.data;
  }

  // ============================================================================
  // Admin Integrations API
  // ============================================================================

  async getIntegrationVendors(category?: string): Promise<VendorConfigResponse[]> {
    const response = await this.api.get<VendorConfigResponse[]>('/api/v1/admin/integrations/vendors', {
      params: category ? { category } : undefined,
    });
    return response.data;
  }

  async getIntegrationStatus(): Promise<IntegrationStatus> {
    const response = await this.api.get<IntegrationStatus>('/api/v1/admin/integrations/status');
    return response.data;
  }

  async createIntegrationVendor(data: VendorConfigCreate): Promise<VendorConfigResponse> {
    const response = await this.api.post<VendorConfigResponse>('/api/v1/admin/integrations/vendors', data);
    return response.data;
  }

  async updateIntegrationVendor(id: string, data: VendorConfigUpdate): Promise<VendorConfigResponse> {
    const response = await this.api.put<VendorConfigResponse>(`/api/v1/admin/integrations/vendors/${id}`, data);
    return response.data;
  }

  async deleteIntegrationVendor(id: string): Promise<void> {
    await this.api.delete(`/api/v1/admin/integrations/vendors/${id}`);
  }

  async testIntegrationVendor(id: string): Promise<TestConnectionResponse> {
    const response = await this.api.post<TestConnectionResponse>(`/api/v1/admin/integrations/vendors/${id}/test`);
    return response.data;
  }

  async setDefaultIntegrationVendor(id: string): Promise<VendorConfigResponse> {
    const response = await this.api.put<VendorConfigResponse>(`/api/v1/admin/integrations/vendors/${id}/set-default`);
    return response.data;
  }

  async getIntegrationVendorConfig(id: string): Promise<{ vendor_id: string; config: Record<string, string> }> {
    const response = await this.api.get<{ vendor_id: string; config: Record<string, string> }>(`/api/v1/admin/integrations/vendors/${id}/config`);
    return response.data;
  }

  // ============================================================================
  // MFA API
  // ============================================================================

  async setupTotp(): Promise<MfaSetupTotpResponse> {
    const response = await this.api.post<MfaSetupTotpResponse>('/api/v1/mfa/setup-totp');
    return response.data;
  }

  async enableTotp(code: string, setAsDefault?: boolean): Promise<RecoveryCodesResponse> {
    const response = await this.api.post<RecoveryCodesResponse>('/api/v1/mfa/enable-totp', { code, set_as_default: setAsDefault });
    return response.data;
  }

  async enableEmailMfa(): Promise<{ message: string }> {
    const response = await this.api.post<{ message: string }>('/api/v1/mfa/enable-email');
    return response.data;
  }

  async verifyEmailActivation(code: string): Promise<RecoveryCodesResponse> {
    const response = await this.api.post<RecoveryCodesResponse>('/api/v1/mfa/verify-email-activation', { code });
    return response.data;
  }

  async disableMfa(password: string, method: string): Promise<{ message: string }> {
    const response = await this.api.post<{ message: string }>('/api/v1/mfa/disable', { password, method });
    return response.data;
  }

  async verifyMfaCode(mfaToken: string, code: string, method?: string, isRecoveryCode?: boolean): Promise<MfaVerifyResponse> {
    const response = await this.publicApi.post<MfaVerifyResponse>('/api/v1/mfa/verify', {
      mfa_token: mfaToken,
      code,
      method,
      is_recovery_code: isRecoveryCode,
    });
    return response.data;
  }

  async switchMfaMethod(mfaToken: string, method: string): Promise<{ message: string }> {
    const response = await this.publicApi.post<{ message: string }>('/api/v1/mfa/switch-method', {
      mfa_token: mfaToken,
      method,
    });
    return response.data;
  }

  async resendEmailCode(mfaToken: string): Promise<MfaResendResponse> {
    const response = await this.publicApi.post<MfaResendResponse>('/api/v1/mfa/resend-email-code', {
      mfa_token: mfaToken,
    });
    return response.data;
  }

  async getMfaStatus(): Promise<MfaStatusResponse> {
    const response = await this.api.get<MfaStatusResponse>('/api/v1/mfa/status');
    return response.data;
  }

  async regenerateRecoveryCodes(): Promise<RecoveryCodesResponse> {
    const response = await this.api.post<RecoveryCodesResponse>('/api/v1/mfa/regenerate-recovery-codes');
    return response.data;
  }

  async setDefaultMfaMethod(method: string): Promise<{ message: string }> {
    const response = await this.api.put<{ message: string }>('/api/v1/mfa/default-method', { method });
    return response.data;
  }

  // ============================================================================
  // OAuth API (Public — no auth required)
  // ============================================================================

  async getOAuthProviders(): Promise<ActiveOAuthProvider[]> {
    const response = await this.publicApi.get<ActiveOAuthProvider[]>('/api/v1/oauth/providers');
    return response.data;
  }

  async getOAuthAuthorizeUrl(provider: string): Promise<OAuthAuthorizeResponse> {
    const response = await this.publicApi.get<OAuthAuthorizeResponse>(`/api/v1/oauth/authorize/${provider}`);
    return response.data;
  }

  async oauthCallback(data: OAuthCallbackRequest): Promise<OAuthCallbackResponse> {
    const response = await this.publicApi.post<OAuthCallbackResponse>('/api/v1/oauth/callback', data);
    return response.data;
  }

  // ============================================================================
  // Admin MFA Management API
  // ============================================================================

  async adminGetUsersWithMfa(params: { page?: number; page_size?: number; search?: string } = {}): Promise<PaginatedAdminUsers> {
    const response = await this.api.get<PaginatedAdminUsers>('/api/v1/mfa/admin/users', { params });
    return response.data;
  }

  async adminResetUserMfa(userId: string): Promise<{ message: string }> {
    const response = await this.api.post<{ message: string }>(`/api/v1/mfa/admin/users/${userId}/reset-mfa`);
    return response.data;
  }

  async adminExportUsersExcel(): Promise<Blob> {
    const response = await this.api.get('/api/v1/mfa/admin/users/export', {
      responseType: 'blob',
    });
    return response.data;
  }
}

const apiService = new ApiService();
export default apiService;
export { apiService };
