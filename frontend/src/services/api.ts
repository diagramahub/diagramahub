import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
  ChangePasswordRequest,
  ResetPasswordRequest,
  ResetPasswordConfirm,
  UpdateProfileRequest,
  InstallationStatus
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
  GenerateDiagramRequest,
  GenerateDiagramResponse,
  ImproveDiagramRequest,
  ImproveDiagramResponse,
  AIProviderType
} from '../types/ai';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5172';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add token
    this.api.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
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

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.api.post<AuthResponse>('/api/v1/users/login', data);
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

  async updateAutoGenerate(autoGenerate: boolean): Promise<UserAISettings> {
    const response = await this.api.put<UserAISettings>('/api/v1/ai/settings/auto-generate', { auto_generate: autoGenerate });
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

  async generateDiagram(data: GenerateDiagramRequest): Promise<GenerateDiagramResponse> {
    const response = await this.api.post<GenerateDiagramResponse>('/api/v1/ai/generate-diagram', data);
    return response.data;
  }

  async improveDiagram(data: ImproveDiagramRequest): Promise<ImproveDiagramResponse> {
    const response = await this.api.post<ImproveDiagramResponse>('/api/v1/ai/improve-diagram', data);
    return response.data;
  }
}

const apiService = new ApiService();
export default apiService;
export { apiService };
